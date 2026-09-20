import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { loadDefs } from './defs.js';
import { loadManifests } from './manifest.js';
import { readValues, writeValues, parseCliValue, validateValue } from './values.js';
import { resolveLayered, writeResolved } from './resolve.js';
import { fanOut, boundParams, unmetRequirement } from './fanout.js';
import { readJson } from './store.js';
import { withLock } from './lock.js';
import { loadStore, loadLayers, withScratch, activeJson, RESOLUTION_ORDER } from './layers.js';
import { listContexts, readLook, readActive, lookPath } from './contexts.js';
import { readScratch, writeScratch } from './scratch.js';
import { runContext } from './context-cli.js';
import { runCommit } from './commit.js';
import { loadRack } from './rack.js';
import { MODES, planReset, visibleGroups } from './reset.js';
import { planMigration, replacements, writeBackup, writeMigrated, runPairMigration, assertPairLayout, pairLayoutSources } from './migrate.js';
import {
  configDir,
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

function splitBaseFlag(rest) {
  const toBase = rest[0] === '--base';
  return { toBase, args: toBase ? rest.slice(1) : rest };
}

// Every read of the store happens under the store lock: a slot and the file it
// names must come from the same write.
const snapshot = (defs) => withLock(lockPath(), async () => loadStore(defs));

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
        const { toBase, args } = splitBaseFlag(rest);
        if (args.length !== 2) throw new Error('usage: prism set [--base] <key> <value>');
        const [key, text] = args;
        const { defs, manifests } = load();
        const def = defs.get(key);
        if (!def) throw new Error(`unknown param ${key}`);
        const value = parseCliValue(def, text);
        validateValue(def, value);

        let resolved;
        await withLock(lockPath(), async () => {
          const store = loadStore(defs);
          if (toBase) {
            const values = { ...store.base };
            if (isDeepStrictEqual(value, def.default)) delete values[key];
            else values[key] = value;
            writeValues(values);
          } else {
            // Normalized: a value the fold beneath already shows is no edit,
            // so dragging back to where a slider started leaves nothing behind.
            const scratch = { ...store.scratch };
            if (isDeepStrictEqual(value, store.beneath[key])) delete scratch[key];
            else scratch[key] = value;
            writeScratch(scratch);
          }
          resolved = writeResolved(loadStore(defs).params);
        });

        return report(await fanOut({ manifests, resolved, changedKeys: [key], runner: opts.runner }), eprint);
      }

      case 'unset': {
        const { toBase, args } = splitBaseFlag(rest);
        if (args.length !== 1) throw new Error('usage: prism unset [--base] <key>');
        const [key] = args;
        const { defs, manifests } = load();
        let resolved;

        await withLock(lockPath(), async () => {
          assertPairLayout();
          const active = readActive();
          const layers = loadLayers(active);
          const base = readValues();
          const scratch = readScratch();
          const held = toBase ? base : scratch;
          const orphan = !defs.has(key) && Object.hasOwn(held, key);
          if (!defs.has(key) && !orphan) throw new Error(`unknown param ${key}`);
          if (!Object.hasOwn(held, key)) {
            throw new Error(toBase ? `${key}: not set in base` : `${key}: not edited`);
          }
          const values = { ...held };
          delete values[key];
          resolveLayered(defs, toBase ? values : base, withScratch(layers, toBase ? scratch : values));
          if (toBase) writeValues(values);
          else writeScratch(values);
          resolved = writeResolved(loadStore(defs).params);
        });

        return report(await fanOut({ manifests, resolved, changedKeys: [key], runner: opts.runner }), eprint);
      }

      case 'reset': {
        const usage = 'usage: prism reset revert|symmetric|neutral [--base] [--group <name>]';
        let mode = null;
        let group = null;
        let toBase = false;
        for (let index = 0; index < rest.length; index += 1) {
          const arg = rest[index];
          if (arg === '--base') toBase = true;
          else if (arg === '--group') {
            index += 1;
            group = rest[index];
            if (group === undefined) throw new Error(usage);
          } else if (mode === null) mode = arg;
          else throw new Error(usage);
        }
        if (!MODES.includes(mode)) throw new Error(usage);

        const { defs, manifests } = load();
        const groups = visibleGroups(defs);
        if (group !== null && !groups.has(group)) {
          throw new Error(`unknown group ${group}; groups with visible parameters: ${[...groups].sort().join(', ')}`);
        }

        let resolved = null;
        let changedKeys = [];
        await withLock(lockPath(), async () => {
          const store = loadStore(defs);
          // --base targets base and compares against base alone: an overlay
          // that happens to sit at the neutral must not block a base change
          // the user asked for by name. Otherwise the target is scratch.
          const held = toBase ? store.base : store.scratch;
          const effective = toBase ? resolveLayered(defs, store.base, []).params : store.params;
          const beneath = toBase ? resolveLayered(defs, {}, []).params : store.beneath;
          const plan = planReset({ defs, mode, group, held, effective, beneath });
          changedKeys = plan.changedKeys;
          if (changedKeys.length === 0) return;
          if (toBase) writeValues(plan.values);
          else writeScratch(plan.values);
          resolved = writeResolved(loadStore(defs).params);
        });

        if (changedKeys.length === 0) return 0;
        return report(await fanOut({ manifests, resolved, changedKeys, runner: opts.runner }), eprint);
      }

      case 'get': {
        if (rest.length !== 1) throw new Error('usage: prism get <key>');
        const [key] = rest;
        const { defs } = load();
        if (!defs.has(key)) throw new Error(`unknown param ${key}`);
        print(`${JSON.stringify((await snapshot(defs)).params[key])}\n`);
        return 0;
      }

      case 'list': {
        if (rest.length !== 0) throw new Error('usage: prism list');
        const { defs } = load();
        const { params } = await snapshot(defs);
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
        const store = await snapshot(defs);
        const rack = loadRack(defsDir(), defs);
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
            neutral: def.neutral,
            neutralize: def.neutralize,
            held: store.held[key],
            value: store.params[key],
            layer: store.layerOf[key],
            fallback: store.fallback[key],
            ui: def.ui,
            description: def.description,
            bindings,
            effectiveLiveness,
            effectiveDrag,
          });
        }

        print(`${JSON.stringify({ active: activeJson(store.active), profiles: store.profiles, layers: RESOLUTION_ORDER, rack, params: described }, null, 2)}\n`);
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
          resolved = writeResolved(loadStore(defs).params);
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

      // doctor's requirement pass alone, for a machine that has not applied
      // anything yet: dotfiles' setup preflight runs it before doctor could get
      // past the generated files setup is about to create. A missing store
      // resolves to the defaults, so `when` evaluates on a fresh machine.
      case 'requirements': {
        if (rest.length !== 0) throw new Error('usage: prism requirements');
        const { defs, manifests } = load();
        const { params } = await snapshot(defs);
        let unmetCount = 0;
        for (const manifest of manifests) {
          const unmet = unmetRequirement(manifest, { params });
          if (!unmet) continue;
          print(`requirements: ${manifest.sink}: ${unmet}\n`);
          unmetCount++;
        }
        if (unmetCount === 0) print('requirements: ok\n');
        return unmetCount === 0 ? 0 : 1;
      }

      case 'doctor': {
        if (rest.length !== 0) throw new Error('usage: prism doctor');
        const { defs, manifests } = load();
        let problems = 0;

        for (const manifest of manifests) {
          for (const name of manifest.generates) {
            if (!fs.existsSync(generatedPath(name))) {
              print(`doctor: ${manifest.sink}: generated file missing: ${name} — run 'prism apply ${manifest.sink}'\n`);
              problems++;
            }
          }
        }

        const { params, blocked } = await withLock(lockPath(), async () => {
          let contextProblems = 0;
          const replaced = replacements(defs);
          for (const source of pairLayoutSources()) {
            print(`doctor: old pair layout: ${source} — run 'prism migrate pairs'\n`);
            contextProblems++;
          }
          let active = {};
          let scratch = {};
          try { active = readActive(); scratch = readScratch(); }
          catch (error) { print(`doctor: ${error.message}\n`); contextProblems++; }
          const diagnose = (values, where, remedy) => {
            let invalid = false;
            for (const [key, value] of Object.entries(values)) {
              const def = defs.get(key);
              let message;
              if (!def) {
                message = replaced.has(key)
                  ? `pending migration: ${key} in ${where} is replaced by ${replaced.get(key).key} — run 'prism migrate'`
                  : `orphan value ${key}${where === 'base' ? '' : ` in ${where}`}: no definition — ${remedy.replace('<key>', key)}`;
              } else {
                try { validateValue(def, value); }
                catch (error) { message = `${where}: ${error.message}`; }
              }
              if (message) { print(`doctor: ${message}\n`); contextProblems++; invalid = true; }
            }
            return invalid;
          };
          const names = listContexts().profile;
          if (active.profile !== undefined && !names.includes(active.profile)) {
            print(`doctor: profile ${active.profile}: active context is missing — run 'prism context deactivate profile'\n`);
            contextProblems++;
          }
          for (const name of [null, ...names]) {
            const where = name === null ? 'base' : `profile ${name}`;
            let broken = false;
            try {
              const look = readLook(name);
              broken = diagnose(look.values, where, name === null ? "run 'prism unset --base <key>'" : `edit ${lookPath(name)}`);
              for (const [id, pair] of Object.entries(look.wallpapers)) {
                const invalid = diagnose(pair.values, `${where} / wallpaper ${id}`, `edit ${lookPath(name)}`);
                if (id === active.wallpaper?.id) broken ||= invalid;
              }
            } catch (error) { print(`doctor: ${where}: ${error.message}\n`); contextProblems++; broken = true; }
            if (broken && name !== null && name === active.profile) {
              print(`doctor: profile ${name}: active look is broken — run 'prism context deactivate profile'\n`);
            }
          }
          diagnose(scratch, 'scratch', "run 'prism unset <key>'");
          if (contextProblems > 0) return { params: null, blocked: true };
          return { params: loadStore(defs).params, blocked: false };
        });

        if (blocked) return 1;
        const status = readJson(sinkStatusPath(), {});
        for (const manifest of manifests) {
          const unmet = unmetRequirement(manifest, { params });
          if (unmet) {
            print(`doctor: ${manifest.sink}: ${unmet}\n`);
            problems++;
            continue;
          }
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

      case 'commit': {
        const { defs } = load();
        return await runCommit(rest, { defs });
      }

      case 'migrate': {
        if (rest.length === 1 && rest[0] === 'pairs') {
          const { defs } = load();
          await withLock(lockPath(), async () => runPairMigration(defs, { print }));
          return 0;
        }
        if (rest.length !== 0) throw new Error('usage: prism migrate [pairs]');
        const { defs } = load();
        const migrated = await withLock(lockPath(), async () => {
          const files = planMigration(defs);
          if (files.length === 0) return 0;
          const backup = writeBackup(files, new Date());
          const restore = 'copy ' + [
            files.some((file) => file.kind === 'look') && `config files back over ${configDir()}`,
            files.some((file) => file.kind === 'runtime') && 'state/active.json back to the runtime document',
          ].filter(Boolean).join(' and ') + ' to undo';
          print(`migrate: backup ${backup}\n`);
          for (const file of files) {
            try {
              writeMigrated(file);
            } catch (error) {
              throw new Error(`migrate: ${file.where}: ${error.message}; the files reported above are migrated, `
                + `this one and those after it are not; the originals are in ${backup} — ${restore}`);
            }
            for (const change of file.changes) {
              print(change.kept
                ? `migrate: ${change.where ?? file.where}: ${change.from} ${JSON.stringify(change.old)} removed; ${change.to} ${JSON.stringify(change.value)} kept\n`
                : `migrate: ${change.where ?? file.where}: ${change.from} ${JSON.stringify(change.old)} -> ${change.to} ${JSON.stringify(change.value)}\n`);
            }
          }
          return files.length;
        });
        if (migrated === 0) {
          print('migrate: nothing to migrate\n');
          return 0;
        }
        print("migrate: done — run 'prism apply' to hand the new keys to the sinks\n");
        return 0;
      }

      case 'context': {
        const { defs, manifests } = load();
        const outcome = await runContext(rest, { defs, manifests, print, eprint, runner: opts.runner });
        return outcome === null ? 0 : report(outcome, eprint);
      }

      default:
        eprint('usage: prism set|unset|get|list|describe|apply|requirements|doctor|migrate|context|reset|commit\n');
        return 2;
    }
  } catch (error) {
    eprint(`prism: ${error.message}\n`);
    return 1;
  }
}
