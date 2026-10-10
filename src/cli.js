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
import { runCommit } from './commit.js';
import { runContext } from './context-cli.js';
import { UsageError, parseInvocation, helpText, rootHelp, candidatesFor, completionScript } from './commands.js';
import { loadRack } from './rack.js';
import { loadDry } from './dry.js';
import { nodeMap } from './nodes.js';
import { planReset, visibleGroups } from './reset.js';
import { planMigration, replacements, writeBackup, writeMigrated, runPairMigration, assertPairLayout, pairLayoutSources } from './migrate.js';
import { readEffective } from './effective.js';
import {
  configDir,
  defsDir,
  generatedPath,
  integrationsDir,
  lockPath,
  resolvedPath,
  sinkStatusPath,
} from './paths.js';

const LIVENESS_ORDER = { live: 0, reload: 1, restart: 2 };
const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

function load() {
  const defs = loadDefs(defsDir());
  return { defs, manifests: loadManifests(integrationsDir(), defs) };
}

// Every read of the store happens under the store lock: a slot and the file it
// names must come from the same write.
const snapshot = (defs) => withLock(lockPath(), async () => loadStore(defs));

// resolved.json is derived: an interrupted writer can leave it behind its inputs,
// and no sink snapshot shows that. Names what is wrong with the saved bus against
// the fresh params, or null when it matches. Read errors other than bad JSON escape.
const MISSING = Symbol('missing');
const isMapping = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function busProblem(fresh) {
  let bus;
  try { bus = readJson(resolvedPath(), MISSING); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return `unreadable (${error.message})`;
  }
  if (bus === MISSING) return 'missing';
  if (!isMapping(bus) || !isMapping(bus.params)) return 'no params mapping';
  return isDeepStrictEqual(bus.params, fresh) ? null : 'stale (bus differs from current values)';
}

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

// The declared table validates the options; the verbs still read the expected-slot
// pair and `--look` positionally, as the panel sends them.
function expectedArgs(positionals, options) {
  const args = [...positionals];
  if (options['expect-look'] !== undefined) args.push('--expect-look', options['expect-look']);
  if (options['expect-wallpaper'] !== undefined) args.push('--expect-wallpaper', options['expect-wallpaper']);
  return args;
}

function contextArgs(verb, positionals, options) {
  if (verb === 'show') return options.look !== undefined ? [...positionals, '--look', options.look] : [...positionals];
  return expectedArgs(positionals, options);
}

function describeText(store, rack) {
  const active = activeJson(store.active);
  const lines = [
    `wallpaper: ${active.wallpaper === null ? 'none' : `${active.wallpaper.id}  ${active.wallpaper.path}${active.wallpaper.pinned ? ' (pinned)' : ''}`}`,
    `profile: ${active.profile ?? 'none'}`,
    `edits: ${Object.keys(store.scratch).length}`,
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

        return report(await fanOut({ manifests, resolved, changedKeys: [key], runner: opts.runner }), output, [key]);
      }

      case 'unset': {
        const [key] = positionals;
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
        const rack = loadRack(defsDir(), defs, { dry: loadDry(integrationsDir()), nodes: nodeMap(manifests) });
        const effective = readEffective(defs);
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
            held: store.held[key],
            value: store.params[key],
            layer: store.layerOf[key],
            fallback: store.fallback[key],
            ui: def.ui,
            description: def.description,
            bindings,
            effectiveLiveness,
            effectiveDrag,
            ...(effective.has(key) ? { effective: effective.get(key) } : {}),
          });
        }

        print(`${JSON.stringify({ active: activeJson(store.active), profiles: store.profiles, layers: RESOLUTION_ORDER, rack, params: described }, null, 2)}\n`);
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
        const { params } = await snapshot(defs);
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
          let contextProblems = 0;
          const replaced = replacements(defs);
          for (const source of pairLayoutSources()) {
            problems.push(`old pair layout: ${source} — run 'prism migrate pairs'`);
            contextProblems++;
          }
          let active = {};
          let scratch = {};
          try { active = readActive(); scratch = readScratch(); }
          catch (error) { problems.push(error.message); contextProblems++; }
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
              if (message) { problems.push(message); contextProblems++; invalid = true; }
            }
            return invalid;
          };
          const names = listContexts().profile;
          if (active.profile !== undefined && !names.includes(active.profile)) {
            problems.push(`profile ${active.profile}: active context is missing — run 'prism context deactivate profile'`);
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
            } catch (error) { problems.push(`${where}: ${error.message}`); contextProblems++; broken = true; }
            if (broken && name !== null && name === active.profile) {
              problems.push(`profile ${name}: active look is broken — run 'prism context deactivate profile'`);
            }
          }
          diagnose(scratch, 'scratch', "run 'prism unset <key>'");
          if (contextProblems > 0) return { params: null, blocked: true };
          const fresh = loadStore(defs).params;
          const bus = busProblem(fresh);
          if (bus) problems.push(`resolved.json: ${bus} — run 'prism apply'`);
          return { params: fresh, blocked: false };
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

      case 'commit': {
        const { defs } = load();
        const committed = await runCommit(expectedArgs(positionals, options), { defs });
        emit(committed, '');
        return 0;
      }

      case 'migrate': {
        const { defs } = load();
        if (positionals[0] === 'pairs') {
          await withLock(lockPath(), async () => runPairMigration(defs, { print: (text) => { if (!json) print(text); } }));
          return 0;
        }
        // Pretty mode streams: the backup line lands before any write, then each file as
        // it is rewritten, so a failure part-way leaves what landed on the screen. Under
        // --json the one object is emitted after the lock, and a failure names the
        // migrated files in its detail instead.
        const line = (text) => { if (!json) print(text); };
        const changeLine = (where, change) => (change.kept
          ? `migrate: ${change.where ?? where}: ${change.from} ${JSON.stringify(change.old)} removed; ${change.to} ${JSON.stringify(change.value)} kept\n`
          : `migrate: ${change.where ?? where}: ${change.from} ${JSON.stringify(change.old)} -> ${change.to} ${JSON.stringify(change.value)}\n`);
        const migrated = await withLock(lockPath(), async () => {
          const files = planMigration(defs);
          if (files.length === 0) return { backup: null, files: [] };
          const backup = writeBackup(files, new Date());
          const restore = 'copy ' + [
            files.some((file) => file.kind === 'look') && `config files back over ${configDir()}`,
            files.some((file) => file.kind === 'runtime') && 'state/active.json back to the runtime document',
          ].filter(Boolean).join(' and ') + ' to undo';
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
                + `the originals are in ${backup} — ${restore}`);
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
        const change = await runContext(inv.cmd.path[1], contextArgs(inv.cmd.path[1], positionals, options), { defs, manifests, emit, print, eprint, json, runner: opts.runner });
        return change === null ? 0 : report(change.result ?? UNCHANGED, output, change.changedKeys);
      }

      default:
        throw new Error(`prism ${inv.cmd.path.join(' ')} is declared but not implemented`);
    }
  } catch (error) {
    return fail(error.message);
  }
}
