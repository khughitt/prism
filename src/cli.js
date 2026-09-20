import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { loadDefs } from './defs.js';
import { loadManifests } from './manifest.js';
import { readValues, writeValues, parseCliValue, validateValue } from './values.js';
import { resolveLayered, writeResolved } from './resolve.js';
import { fanOut, boundParams, unmetRequirement } from './fanout.js';
import { readJson } from './store.js';
import { withLock } from './lock.js';
import { loadStore, loadLayers, writeTarget, activeJson, RESOLUTION_ORDER } from './layers.js';
import { listContexts, readContext, readActive, writeContext, deleteContext, contextPath, VERB_KINDS } from './contexts.js';
import { runContext } from './context-cli.js';
import { UsageError, parseInvocation, helpText, rootHelp, candidatesFor, completionScript } from './commands.js';
import { loadRack } from './rack.js';
import { planReset, visibleGroups } from './reset.js';
import { planMigration, replacements, writeBackup, writeMigrated } from './migrate.js';
import {
  configDir,
  defsDir,
  generatedPath,
  integrationsDir,
  lockPath,
  sinkStatusPath,
} from './paths.js';

const LIVENESS_ORDER = { live: 0, reload: 1, restart: 2 };
const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

function load() {
  const defs = loadDefs(defsDir());
  return { defs, manifests: loadManifests(integrationsDir(), defs) };
}

function contextSource(active, target) {
  return target.kind === 'wallpaper' ? active.wallpaper.path : null;
}

// Every read of the store happens under the store lock: a slot and the file it
// names must come from the same write.
const snapshot = (defs) => withLock(lockPath(), async () => loadStore(defs));

// A failure that ran: exit 1, the message on stderr — one error object under --json,
// `prism: <message>` otherwise. Usage errors never reach here; parseInvocation exits 2.
function failer(eprint, json) {
  return (message) => {
    eprint(json ? `${JSON.stringify({ error: { kind: 'prism', detail: message } })}\n` : `prism: ${message}\n`);
    return 1;
  };
}

// The outcome of a change that fanned out: under --json the one value is the keys that
// changed and the sinks that took them; pretty mode stays silent on success as it always
// has. Failures are the error object (json) or one `prism: <sink>: <error>` line per sink.
function report({ applied, failed }, { print, eprint, json, fail }, changedKeys) {
  if (failed.length === 0) {
    if (json) print(`${JSON.stringify({ changed: changedKeys, applied })}\n`);
    return 0;
  }
  const messages = failed.map((failure) => `${failure.sink}: ${failure.error}`);
  if (json) return fail(messages.join('; '));
  for (const message of messages) eprint(`prism: ${message}\n`);
  return 1;
}

const UNCHANGED = { applied: [], failed: [] };

function describeText(store, rack) {
  const active = activeJson(store.active);
  const lines = [
    `wallpaper: ${active.wallpaper === null ? 'none' : `${active.wallpaper.id}  ${active.wallpaper.path}${active.wallpaper.pinned ? ' (pinned)' : ''}`}`,
    `profile: ${active.profile ?? 'none'}`,
    `target: ${store.target.kind}`,
    `profiles: ${store.profiles.length === 0 ? 'none' : store.profiles.join(', ')}`,
    `layers: ${RESOLUTION_ORDER.join(', ')}`,
    `rack: ${rack.group}: ${rack.devices.map((device) => device.device).join(', ')}`,
    'params:',
    ...Object.keys(store.params).map((key) => `  ${key} = ${JSON.stringify(store.params[key])}  [${store.layerOf[key]}]`),
  ];
  return `${lines.join('\n')}\n`;
}

export async function run(argv, opts = {}) {
  const print = opts.print ?? ((text) => process.stdout.write(text));
  const eprint = opts.eprint ?? ((text) => process.stderr.write(text));
  const env = opts.env ?? process.env;

  if (env.PRISM_COMPLETE) {
    if (argv.length === 0) { print(completionScript(env.PRISM_COMPLETE)); return 0; }
    if (argv[0] === '--') {
      for (const [v, d] of candidatesFor(argv.slice(1), Number(env.PRISM_COMPLETE_INDEX ?? argv.length - 2))) print(`${v}\t${d}\n`);
      return 0;
    }
  }

  let inv;
  try {
    inv = parseInvocation(argv, env);
  } catch (error) {
    if (error instanceof UsageError) { eprint(`prism: ${error.message}\n`); return 2; }
    throw error;
  }
  if (inv.version) { print(`prism ${VERSION}\n`); return 0; }
  if (Object.hasOwn(inv, 'help')) { print(inv.help === null ? rootHelp() : helpText(inv.help)); return 0; }

  const json = inv.mode === 'json';
  const fail = failer(eprint, json);
  const output = { print, eprint, json, fail };
  // One value in each mode: the JSON object under --json, the text lines otherwise.
  const emit = (value, text) => print(json ? `${JSON.stringify(value)}\n` : text);
  const { positionals, options } = inv;
  const toBase = options.base === true;

  try {
    switch (inv.cmd.path[0]) {
      case 'set': {
        const [key, text] = positionals;
        const { defs, manifests } = load();
        const def = defs.get(key);
        if (!def) throw new Error(`unknown param ${key}`);
        const value = parseCliValue(def, text);
        validateValue(def, value);

        let resolved;
        await withLock(lockPath(), async () => {
          const store = loadStore(defs);
          const target = toBase ? { kind: 'base', name: null } : store.target;
          if (target.kind === 'base') {
            const values = { ...store.base };
            if (isDeepStrictEqual(value, def.default)) delete values[key];
            else values[key] = value;
            writeValues(values);
          } else {
            const layer = store.layers.find((l) => l.kind === target.kind && l.name === target.name);
            writeContext(target.kind, target.name, {
              source: contextSource(store.active, target),
              values: { ...layer.values, [key]: value },
            });
          }
          resolved = writeResolved(loadStore(defs).params);
        });

        return report(await fanOut({ manifests, resolved, changedKeys: [key], runner: opts.runner }), output, [key]);
      }

      case 'unset': {
        const [key] = positionals;
        const { defs, manifests } = load();
        let resolved;

        await withLock(lockPath(), async () => {
          const active = readActive();
          const layers = loadLayers(active);
          const target = toBase ? { kind: 'base', name: null } : writeTarget(active);
          const base = readValues();
          const held = target.kind === 'base'
            ? base
            : layers.find((l) => l.kind === target.kind && l.name === target.name).values;
          const where = target.kind === 'base' ? 'base' : `${target.kind} ${target.name}`;
          const orphan = !defs.has(key) && Object.hasOwn(held, key);
          if (!defs.has(key) && !orphan) throw new Error(`unknown param ${key}`);
          if (!Object.hasOwn(held, key)) throw new Error(`${key}: not set in ${where}`);
          if (!orphan) resolveLayered(defs, base, layers);
          const values = { ...held };
          delete values[key];
          if (target.kind === 'base') writeValues(values);
          else if (target.kind === 'wallpaper' && Object.keys(values).length === 0) {
            deleteContext(target.kind, target.name);
          } else writeContext(target.kind, target.name, { source: contextSource(active, target), values });
          resolved = writeResolved(loadStore(defs).params);
        });

        return report(await fanOut({ manifests, resolved, changedKeys: [key], runner: opts.runner }), output, [key]);
      }

      case 'reset': {
        const [mode] = positionals;
        const group = options.group ?? null;
        const { defs, manifests } = load();
        const groups = visibleGroups(defs);
        if (group !== null && !groups.has(group)) {
          throw new Error(`unknown group ${group}; groups with visible parameters: ${[...groups].sort().join(', ')}`);
        }

        let resolved = null;
        let changedKeys = [];
        await withLock(lockPath(), async () => {
          const store = loadStore(defs);
          const target = toBase ? { kind: 'base', name: null } : store.target;
          const held = target.kind === 'base'
            ? store.base
            : store.layers.find((layer) => layer.kind === target.kind && layer.name === target.name).values;
          // --base compares against, and copies from, the base layer alone: an
          // overlay that happens to sit at the neutral must not block a base
          // change the user asked for by name.
          const effective = toBase ? resolveLayered(defs, store.base, []).params : store.params;
          const plan = planReset({
            defs, mode, group, held, effective, normalizeToDefault: target.kind === 'base',
          });
          changedKeys = plan.changedKeys;
          if (changedKeys.length === 0) return;
          if (target.kind === 'base') writeValues(plan.values);
          else if (target.kind === 'wallpaper' && Object.keys(plan.values).length === 0) {
            deleteContext(target.kind, target.name);
          } else {
            writeContext(target.kind, target.name, {
              source: contextSource(store.active, target),
              values: plan.values,
            });
          }
          resolved = writeResolved(loadStore(defs).params);
        });

        if (changedKeys.length === 0) return report(UNCHANGED, output, []);
        return report(await fanOut({ manifests, resolved, changedKeys, runner: opts.runner }), output, changedKeys);
      }

      case 'get': {
        const [key] = positionals;
        const { defs } = load();
        if (!defs.has(key)) throw new Error(`unknown param ${key}`);
        const value = (await snapshot(defs)).params[key];
        print(`${JSON.stringify(json ? { key, value } : value)}\n`);
        return 0;
      }

      case 'list': {
        const { defs } = load();
        const { params } = await snapshot(defs);
        if (json) {
          print(`${JSON.stringify({ params })}\n`);
          return 0;
        }
        for (const key of Object.keys(params)) {
          print(`${key} = ${JSON.stringify(params[key])}\n`);
        }
        return 0;
      }

      case 'describe': {
        const { defs, manifests } = load();
        const store = await snapshot(defs);
        const rack = loadRack(defsDir(), defs);
        if (!json) {
          print(describeText(store, rack));
          return 0;
        }
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
            heldInTarget: store.heldInTarget[key],
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

        print(`${JSON.stringify({ active: activeJson(store.active), profiles: store.profiles, layers: RESOLUTION_ORDER, target: store.target.kind, rack, params: described }, null, 2)}\n`);
        return 0;
      }

      case 'apply': {
        const { defs, manifests } = load();
        const knownSinks = new Set(manifests.map((manifest) => manifest.sink));
        const unknown = positionals.find((sink) => !knownSinks.has(sink));
        if (unknown) throw new Error(`unknown sink ${unknown}`);
        const targets = positionals.length === 0
          ? manifests
          : manifests.filter((manifest) => positionals.includes(manifest.sink));

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
        }), output, changedKeys);
      }

      // doctor's requirement pass alone, for a machine that has not applied
      // anything yet: dotfiles' setup preflight runs it before doctor could get
      // past the generated files setup is about to create. A missing store
      // resolves to the defaults, so `when` evaluates on a fresh machine.
      case 'requirements': {
        const { defs, manifests } = load();
        const { params } = loadStore(defs);
        const unmet = manifests
          .map((manifest) => ({ sink: manifest.sink, requirement: unmetRequirement(manifest, { params }) }))
          .filter((entry) => entry.requirement);
        emit({ ok: unmet.length === 0, unmet }, unmet.length === 0
          ? 'requirements: ok\n'
          : unmet.map((entry) => `requirements: ${entry.sink}: ${entry.requirement}\n`).join(''));
        return unmet.length === 0 ? 0 : 1;
      }

      case 'doctor': {
        const { defs, manifests } = load();
        // Every finding is one text line or one entry of the JSON object. Store problems
        // (orphans, broken contexts, invalid values) block the sink pass, so they are
        // counted on their own as well.
        const problems = [];
        const finish = () => {
          emit({ ok: problems.length === 0, problems }, problems.length === 0
            ? 'doctor: ok\n'
            : problems.map((problem) => `doctor: ${problem}\n`).join(''));
          return problems.length === 0 ? 0 : 1;
        };

        for (const manifest of manifests) {
          for (const name of manifest.generates) {
            if (!fs.existsSync(generatedPath(name))) {
              problems.push(`${manifest.sink}: generated file missing: ${name} — run 'prism apply ${manifest.sink}'`);
            }
          }
        }

        const { params, blocked } = await withLock(lockPath(), async () => {
          const values = readValues();
          const replaced = replacements(defs);
          const orphans = Object.keys(values).filter((key) => !defs.has(key));
          for (const key of orphans) {
            if (replaced.has(key)) {
              problems.push(`pending migration: ${key} in base is replaced by ${replaced.get(key).key} — run 'prism migrate'`);
            } else {
              problems.push(`orphan value ${key}: no definition — run 'prism unset ${key}'`);
            }
          }

          let contextProblems = 0;
          for (const [key, value] of Object.entries(values)) {
            const def = defs.get(key);
            if (!def) continue; // orphan, already reported above
            try {
              validateValue(def, value);
            } catch (error) {
              problems.push(`base: ${error.message}`);
              contextProblems++;
            }
          }

          const active = readActive();
          if (active.profile !== undefined && readContext('profile', active.profile) === null) {
            problems.push(`profile ${active.profile}: active context is missing — run 'prism context deactivate profile'`);
            contextProblems++;
          }
          const all = listContexts();
          for (const kind of VERB_KINDS) {
            for (const name of all[kind]) {
              let context;
              try {
                context = readContext(kind, name);
              } catch (error) {
                problems.push(error.message);
                contextProblems++;
                continue;
              }
              for (const [key, value] of Object.entries(context.values)) {
                const def = defs.get(key);
                if (!def) {
                  if (replaced.has(key)) {
                    problems.push(`pending migration: ${key} in ${kind} ${name} is replaced by ${replaced.get(key).key} — run 'prism migrate'`);
                  } else {
                    problems.push(`orphan value ${key} in ${kind} ${name}: no definition — edit ${contextPath(kind, name)}`);
                  }
                  contextProblems++;
                  continue;
                }
                try {
                  validateValue(def, value);   // inactive contexts are never resolved, so check them here
                } catch (error) {
                  problems.push(`${kind} ${name}: ${error.message}`);
                  contextProblems++;
                }
              }
            }
          }
          if (orphans.length > 0 || contextProblems > 0) return { params: null, blocked: true };
          const { params } = loadStore(defs);
          return { params, blocked: false };
        });

        if (blocked) return finish();
        const status = readJson(sinkStatusPath(), {});
        for (const manifest of manifests) {
          const unmet = unmetRequirement(manifest, { params });
          if (unmet) {
            problems.push(`${manifest.sink}: ${unmet}`);
            continue;
          }
          const entry = status[manifest.sink];
          const expected = boundParams(manifest, { params });
          if (!entry) {
            problems.push(`${manifest.sink}: never applied`);
          } else if (!entry.ok) {
            problems.push(`${manifest.sink}: failed: ${entry.error}`);
          } else if (!isDeepStrictEqual(entry.params, expected)) {
            problems.push(`${manifest.sink}: stale (applied values differ from current)`);
          }
        }

        return finish();
      }

      case 'migrate': {
        const { defs } = load();
        // Pretty mode streams: the backup line lands before any write, then each file as
        // it is rewritten, so a failure part-way leaves what landed on the screen. Under
        // --json the one object is emitted after the lock, and a failure names the
        // migrated files in its detail instead.
        const line = (text) => { if (!json) print(text); };
        const changeLine = (where, change) => (change.kept
          ? `migrate: ${where}: ${change.from} ${JSON.stringify(change.old)} removed; ${change.to} ${JSON.stringify(change.value)} kept\n`
          : `migrate: ${where}: ${change.from} ${JSON.stringify(change.old)} -> ${change.to} ${JSON.stringify(change.value)}\n`);
        const migrated = await withLock(lockPath(), async () => {
          const files = planMigration(defs);
          if (files.length === 0) return { backup: null, files: [] };
          const backup = writeBackup(files, new Date());
          line(`migrate: backup ${backup}\n`);
          const done = [];
          for (const file of files) {
            try {
              writeMigrated(file);
            } catch (error) {
              const landed = json
                ? (done.length === 0 ? 'no file is migrated;' : `migrated: ${done.map((f) => f.where).join(', ')};`)
                : 'the files reported above are migrated,';
              throw new Error(`migrate: ${file.where}: ${error.message}; ${landed} this one and those after it are not; `
                + `the originals are in ${backup} — copy them back over ${configDir()} to undo`);
            }
            done.push({ where: file.where, changes: file.changes });
            for (const change of file.changes) line(changeLine(file.where, change));
          }
          return { backup, files: done };
        });
        if (migrated.files.length === 0) {
          emit(migrated, 'migrate: nothing to migrate\n');
          return 0;
        }
        emit(migrated, "migrate: done — run 'prism apply' to hand the new keys to the sinks\n");
        return 0;
      }

      case 'context': {
        const { defs, manifests } = load();
        // A verb that changed the slots returns { changedKeys, result }; one that printed
        // its own value through emit returns null.
        const change = await runContext(inv.cmd.path[1], positionals, { defs, manifests, emit, eprint, json, runner: opts.runner });
        return change === null ? 0 : report(change.result ?? UNCHANGED, output, change.changedKeys);
      }

      default:
        throw new Error(`prism ${inv.cmd.path.join(' ')} is declared but not implemented`);
    }
  } catch (error) {
    return fail(error.message);
  }
}
