import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { loadDefs } from './defs.js';
import { loadManifests } from './manifest.js';
import { readValues, writeValues, parseCliValue, validateValue } from './values.js';
import { resolveParams, writeResolved } from './resolve.js';
import { fanOut, boundParams } from './fanout.js';
import { readJson } from './store.js';
import { withLock } from './lock.js';
import {
  defsDir,
  generatedPath,
  integrationsDir,
  lockPath,
  sinkStatusPath,
} from './paths.js';

const LIVENESS_ORDER = { live: 0, reload: 1, restart: 2 };

function load() {
  const defs = loadDefs(defsDir());
  return { defs, manifests: loadManifests(integrationsDir(), defs) };
}

function report({ failed }, eprint) {
  for (const failure of failed) {
    eprint(`prism: ${failure.sink}: ${failure.error}\n`);
  }
  return failed.length === 0 ? 0 : 1;
}

export async function run(argv, opts = {}) {
  const print = opts.print ?? ((text) => process.stdout.write(text));
  const eprint = opts.eprint ?? ((text) => process.stderr.write(text));
  const [verb, ...rest] = argv;

  try {
    switch (verb) {
      case 'set': {
        if (rest.length !== 2) throw new Error('usage: prism set <key> <value>');
        const [key, text] = rest;
        const { defs, manifests } = load();
        const def = defs.get(key);
        if (!def) throw new Error(`unknown param ${key}`);
        const value = parseCliValue(def, text);
        validateValue(def, value);

        let resolved;
        await withLock(lockPath(), async () => {
          const values = readValues();
          resolveParams(defs, values);
          if (isDeepStrictEqual(value, def.default)) delete values[key];
          else values[key] = value;
          writeValues(values);
          resolved = writeResolved(defs, values);
        });

        return report(await fanOut({
          manifests,
          resolved,
          changedKeys: [key],
          runner: opts.runner,
        }), eprint);
      }

      case 'unset': {
        if (rest.length !== 1) throw new Error('usage: prism unset <key>');
        const [key] = rest;
        const { defs, manifests } = load();
        let resolved;

        await withLock(lockPath(), async () => {
          const values = readValues();
          const orphan = !defs.has(key) && Object.hasOwn(values, key);
          if (!defs.has(key) && !orphan) throw new Error(`unknown param ${key}`);
          if (!orphan) resolveParams(defs, values);
          delete values[key];
          writeValues(values);
          resolved = writeResolved(defs, values);
        });

        return report(await fanOut({
          manifests,
          resolved,
          changedKeys: [key],
          runner: opts.runner,
        }), eprint);
      }

      case 'get': {
        if (rest.length !== 1) throw new Error('usage: prism get <key>');
        const [key] = rest;
        const { defs } = load();
        if (!defs.has(key)) throw new Error(`unknown param ${key}`);
        print(`${JSON.stringify(resolveParams(defs, readValues())[key])}\n`);
        return 0;
      }

      case 'list': {
        if (rest.length !== 0) throw new Error('usage: prism list');
        const { defs } = load();
        const params = resolveParams(defs, readValues());
        for (const key of Object.keys(params)) {
          print(`${key} = ${JSON.stringify(params[key])}\n`);
        }
        return 0;
      }

      case 'describe': {
        if (rest.length !== 1 || rest[0] !== '--json') {
          throw new Error('usage: prism describe --json');
        }
        const { defs, manifests } = load();
        const values = readValues();
        const params = resolveParams(defs, values);
        const described = [];

        for (const [key, def] of defs) {
          const rawBindings = manifests.flatMap((manifest) => manifest.binds
            .filter((binding) => binding.param === key)
            .map((binding) => ({ ...binding, sink: manifest.sink })));
          const bindings = rawBindings.map(({ sink, liveness }) => ({ sink, liveness }));
          const effectiveLiveness = bindings.reduce((slowest, binding) =>
            slowest === null || LIVENESS_ORDER[binding.liveness] > LIVENESS_ORDER[slowest]
              ? binding.liveness
              : slowest, null);
          const effectiveDrag = rawBindings.length === 0
            ? null
            : rawBindings.some((binding) => binding.liveness !== 'live' || binding.drag === 'release')
              ? 'release'
              : 'live';
          described.push({
            key,
            type: def.type,
            range: def.range,
            values: def.values,
            default: def.default,
            value: params[key],
            modified: Object.hasOwn(values, key),
            ui: def.ui,
            description: def.description,
            bindings,
            effectiveLiveness,
            effectiveDrag,
          });
        }

        print(`${JSON.stringify({ params: described }, null, 2)}\n`);
        return 0;
      }

      case 'apply': {
        const { defs, manifests } = load();
        const knownSinks = new Set(manifests.map((manifest) => manifest.sink));
        const unknown = rest.find((sink) => !knownSinks.has(sink));
        if (unknown) throw new Error(`unknown sink ${unknown}`);
        const targets = rest.length === 0
          ? manifests
          : manifests.filter((manifest) => rest.includes(manifest.sink));

        let resolved;
        await withLock(lockPath(), async () => {
          resolved = writeResolved(defs, readValues());
        });
        const changedKeys = [...new Set(targets.flatMap((manifest) =>
          manifest.binds.map((binding) => binding.param)))];
        return report(await fanOut({
          manifests: targets,
          resolved,
          changedKeys,
          runner: opts.runner,
        }), eprint);
      }

      case 'doctor': {
        if (rest.length !== 0) throw new Error('usage: prism doctor');
        const { defs, manifests } = load();
        const values = readValues();
        let problems = 0;

        for (const manifest of manifests) {
          for (const name of manifest.generates) {
            if (!fs.existsSync(generatedPath(name))) {
              print(`doctor: ${manifest.sink}: generated file missing: ${name} — run 'prism apply ${manifest.sink}'\n`);
              problems++;
            }
          }
        }

        const orphans = Object.keys(values).filter((key) => !defs.has(key));
        for (const key of orphans) {
          print(`doctor: orphan value ${key}: no definition — run 'prism unset ${key}'\n`);
          problems++;
        }
        if (orphans.length > 0) return 1;

        const params = resolveParams(defs, values);
        const status = readJson(sinkStatusPath(), {});
        for (const manifest of manifests) {
          const entry = status[manifest.sink];
          const expected = boundParams(manifest, { params });
          if (!entry) {
            print(`doctor: ${manifest.sink}: never applied\n`);
            problems++;
          } else if (!entry.ok) {
            print(`doctor: ${manifest.sink}: failed: ${entry.error}\n`);
            problems++;
          } else if (!isDeepStrictEqual(entry.params, expected)) {
            print(`doctor: ${manifest.sink}: stale (applied values differ from current)\n`);
            problems++;
          }
        }

        if (problems === 0) print('doctor: ok\n');
        return problems === 0 ? 0 : 1;
      }

      default:
        eprint('usage: prism set|unset|get|list|describe|apply|doctor\n');
        return 2;
    }
  } catch (error) {
    eprint(`prism: ${error.message}\n`);
    return 1;
  }
}
