import fs from 'node:fs';
import { stringify } from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import { withLock } from './lock.js';
import { lockPath } from './paths.js';
import {
  assertKind, assertName, contextPath, deleteContext, inspectContext, listContexts, readActive, readContext,
  readContextText, renameContext, wallpaperId, canonicalWallpaperPath, writeActive, readLook, readRuntime, writeLook, writeRuntime,
  parseExpectedSlots, assertExpectedSlots, parseLookToken,
} from './contexts.js';
import { activeJson, activeName, loadLayers, withScratch } from './layers.js';
import { readScratch } from './scratch.js';
import { checkLayer, resolveLayered, writeResolved } from './resolve.js';
import { fanOut } from './fanout.js';
import { carryScratch } from './carry.js';
import { assertPairLayout, pairLayoutSources } from './migrate.js';

function usage(text) {
  return new Error(`usage: prism context ${text}`);
}

function requireContext(kind, name) {
  const context = readContext(kind, name);
  if (context === null) throw new Error(`${kind} ${name}: no such context`);
  return context;
}

// Arity and the kind's value set are validated against the declared table (commands.js)
// before a verb runs; assertKind stays as the store's own invariant, assertName as the
// file-name rule the table does not express.
function kindAndName([kind, name]) {
  assertKind(kind);
  assertName(name);
  return { kind, name };
}

// Apply a slot change and return { changedKeys, result }, `result` being the fan-out
// outcome or null when nothing reached the bus.
// Resolve and validate both sides before mutation. Only a named outgoing look
// can fail during explicit selection/recovery; base and scratch never share that catch.
async function changeSlots({ defs, manifests, runner }, mutate,
  { commit = () => false, intent = 'wallpaper', without = null, slotBeforeCommit = false, expected = null } = {}) {
  let outcome = null;
  await withLock(lockPath(), async () => {
    assertPairLayout();
    const { active, scratch } = readRuntime();
    assertExpectedSlots(active, expected);
    const baseLook = readLook(null);
    const base = baseLook.values;
    checkLayer(defs, base, 'base');
    checkLayer(defs, scratch, 'scratch');
    const next = mutate(active);
    const selectLook = intent === 'select-profile';
    let outgoingLook;
    let previous = null;
    let recoverOutgoing = false;
    try {
      outgoingLook = active.profile === undefined ? baseLook : readLook(active.profile);
      previous = resolveLayered(defs, base, withScratch(loadLayers(active, outgoingLook), scratch)).params;
    } catch (error) {
      if (active.profile !== undefined && (selectLook || (intent === 'delete-profile' && next.profile !== active.profile))) recoverOutgoing = true;
      else if (without?.kind !== 'wallpaper') throw error;
    }
    // A wallpaper transition (the hook, activate or deactivate wallpaper) saves
    // nothing: it carries the screen across and lets only the incoming pair's
    // keys change. Clear and delete keep the slot or name their own intent.
    const rotation = intent === 'wallpaper' && active.wallpaper?.id !== next.wallpaper?.id;
    const saveOutgoing = !recoverOutgoing && active.wallpaper !== undefined && selectLook;
    let scratchAfter = recoverOutgoing ? scratch : (selectLook ? {} : scratch);
    let folded = null;
    if (saveOutgoing && Object.keys(scratch).length) {
      const id = active.wallpaper.id;
      const old = Object.hasOwn(outgoingLook.wallpapers, id) ? outgoingLook.wallpapers[id] : null;
      folded = { ...outgoingLook, wallpapers: { ...outgoingLook.wallpapers,
        [id]: { source: old?.source ?? active.wallpaper.path, values: { ...old?.values, ...scratch } } } };
      resolveLayered(defs, base, withScratch(loadLayers(active, folded), scratch));
    }
    let incomingLook = folded && active.profile === next.profile ? folded : readLook(next.profile ?? null);
    if (without?.kind === 'wallpaper' && incomingLook !== null) {
      incomingLook = { ...incomingLook, wallpapers: { ...incomingLook.wallpapers } };
      delete incomingLook.wallpapers[without.name];
    }
    const incomingLayers = loadLayers(next, incomingLook);
    if (rotation) {
      const pair = incomingLayers.find((layer) => layer.kind === 'wallpaper')?.values ?? {};
      scratchAfter = carryScratch(previous, resolveLayered(defs, base, incomingLayers).params, pair);
    }
    const { params } = resolveLayered(defs, base, withScratch(incomingLayers, scratchAfter));
    if (folded !== null) writeLook(active.profile ?? null, folded);
    const runtimeChanged = !isDeepStrictEqual({ active: next, scratch: scratchAfter }, { active, scratch });
    if (slotBeforeCommit && runtimeChanged) writeRuntime({ active: next, scratch: scratchAfter });
    const touched = commit(active) === true;
    if (!slotBeforeCommit && runtimeChanged) writeRuntime({ active: next, scratch: scratchAfter });
    if (folded === null && !touched && !runtimeChanged) return;
    const resolved = writeResolved(params);
    const changedKeys = previous === null
      ? [...new Set(manifests.flatMap((manifest) => manifest.binds.map((bind) => bind.param)))]
      : Object.keys(params).filter((key) => !isDeepStrictEqual(params[key], previous[key]));
    outcome = { resolved, changedKeys };
  });
  if (outcome === null || outcome.changedKeys.length === 0) return { changedKeys: [], result: null };
  return { changedKeys: outcome.changedKeys, result: await fanOut({ manifests, resolved: outcome.resolved, changedKeys: outcome.changedKeys, runner }) };
}

// The old-layout warnings precede whatever a read-only verb does, a failure included:
// the old sources are usually what the failure is about. The lock body returns them
// with its value, or carries them on the error it throws.
async function underLockWithLayout(work) {
  return withLock(lockPath(), async () => {
    const layoutSources = [...pairLayoutSources()];
    try { return { layoutSources, ...(await work()) }; }
    catch (error) { error.layoutSources = layoutSources; throw error; }
  });
}

function warnLayout(sources, write) {
  for (const source of sources ?? []) write(`old pair layout: ${source} — run 'prism migrate pairs'`);
}

function requireOnScreen(active, id) {
  if (active.wallpaper === undefined) throw new Error('no active wallpaper');
  if (active.wallpaper.id !== id) throw new Error(`wallpaper ${id} is not on screen`);
}

// A verb that changes the slots returns changeSlots' { changedKeys, result } for cli.js to
// report; every other verb emits its own value (one JSON object, or the text) and returns
// null.
export async function runContext(sub, rest, { defs, manifests, emit, eprint, json, runner }) {
  switch (sub) {
    case 'list': {
      let listing;
      try {
        listing = await underLockWithLayout(async () => {
        const listed = listContexts();
        const active = readActive();
        const pairs = [];
        const errors = [];
        for (const look of [null, ...listed.profile]) {
          try {
            const document = readLook(look);
            for (const [id, pair] of Object.entries(document.wallpapers).sort(([left], [right]) => left.localeCompare(right))) {
              pairs.push({ look, id, source: pair.source });
            }
          } catch (error) {
            errors.push({ look, message: error.message });
          }
        }
        return {
          active,
          all: listed,
          inspected: Object.fromEntries(listed.profile.map((name) => {
            try { return [name, inspectContext('profile', name)]; }
            catch (error) { return [name, { error: error.message }]; }
          })),
          pairs, errors,
          scratch: readScratch(),
        };
        });
      } catch (error) {
        if (!json) warnLayout(error.layoutSources, (text) => eprint(`! ${text}\n`));
        throw error;
      }
      const { active, all, inspected, pairs, errors, scratch, layoutSources } = listing;
      const lines = [];
      const contexts = [];
      for (const source of layoutSources) lines.push(`! old pair layout: ${source} — run 'prism migrate pairs'\n`);
      for (const name of all.profile) {
        const entry = inspected[name];
        if (entry === null) continue;
        contexts.push({ kind: 'profile', name, active: name === active.profile, error: entry.error });
        if (entry.error !== null) lines.push(`! profile ${name}  ${entry.error} — run 'prism doctor'\n`);
        else lines.push(`${name === active.profile ? '*' : ' '} profile ${name}\n`);
      }
      for (const error of errors) {
        if (error.look === null) lines.push(`! look default  ${error.message} — run 'prism doctor'\n`);
      }
      const listedPairs = [];
      for (const pair of pairs) {
        const token = pair.look === null ? 'default' : `profile:${pair.look}`;
        const isActive = pair.look === (active.profile ?? null) && pair.id === active.wallpaper?.id;
        listedPairs.push({ look: pair.look, id: pair.id, source: pair.source, active: isActive, untuned: false });
        lines.push(`${isActive ? '*' : ' '} wallpaper ${token} ${pair.id}  ${pair.source}\n`);
      }
      if (active.wallpaper && !errors.some((error) => error.look === (active.profile ?? null))
          && !pairs.some((pair) => pair.look === (active.profile ?? null) && pair.id === active.wallpaper.id)) {
        const token = active.profile === undefined ? 'default' : `profile:${active.profile}`;
        listedPairs.push({ look: active.profile ?? null, id: active.wallpaper.id, source: active.wallpaper.path, active: true, untuned: true });
        lines.push(`* wallpaper ${token} ${active.wallpaper.id}  ${active.wallpaper.path} (untuned)\n`);
      }
      const edits = Object.keys(scratch).length;
      if (edits > 0) lines.push(`  scratch  ${edits} ${edits === 1 ? 'edit' : 'edits'}\n`);
      emit({
        active: activeJson(active),
        contexts,
        pairs: listedPairs,
        errors: errors.map((error) => ({ look: error.look, detail: error.message })),
        oldPairLayout: layoutSources,
        scratch: { edits },
      }, lines.join(''));
      return null;
    }

    // Showing the file is what was asked for, so a file that does not parse is
    // printed as it is, with the reason on stderr.
    case 'show': {
      const lookFlag = rest[2] === '--look' && rest.length === 4;
      const { kind, name } = kindAndName(lookFlag ? rest.slice(0, 2) : rest);
      let look;
      if (lookFlag) {
        if (kind !== 'wallpaper') throw usage('show wallpaper <id> [--look <look-token>]');
        look = parseLookToken(rest[3]);
      }
      let shown;
      try {
        shown = await underLockWithLayout(async () => {
          const selectedLook = lookFlag ? look : readActive().profile ?? null;
          const entry = inspectContext(kind, name, selectedLook);
          return { entry, profileDoc: kind === 'profile' && entry?.error === null ? readLook(name) : null };
        });
      } catch (error) {
        if (!json) warnLayout(error.layoutSources, (text) => eprint(`prism: ${text}\n`));
        throw error;
      }
      const { entry, profileDoc, layoutSources } = shown;
      const warnings = layoutSources.map((source) => ({ kind: 'prism', detail: `old pair layout: ${source} — run 'prism migrate pairs'` }));
      if (!json) for (const warning of warnings) eprint(`prism: ${warning.detail}\n`);
      if (entry === null) throw new Error(`${kind} ${name}: no such context`);
      if (entry.error !== null) {
        const detail = `${kind} ${name}: ${entry.error} — run 'prism doctor'`;
        emit({ kind, name, text: entry.text, warnings: [...warnings, { kind: 'prism', detail }] }, entry.text);
        if (!json) eprint(`prism: ${detail}\n`);
        return null;
      }
      const { context } = entry;
      const doc = kind === 'wallpaper' ? { _source: context.source, ...context.values } :
        { ...profileDoc.values, ...(Object.keys(profileDoc.wallpapers).length ? { _wallpapers: Object.fromEntries(
          Object.entries(profileDoc.wallpapers).map(([id, pair]) => [id, { _source: pair.source, ...pair.values }])) } : {}) };
      emit(kind === 'wallpaper'
        ? { kind, name, source: context.source, values: context.values, warnings }
        : { kind, name, values: profileDoc.values, wallpapers: profileDoc.wallpapers, warnings }, stringify(doc));
      return null;
    }

    case 'activate': {
      const { kind, name } = kindAndName(rest);
      return changeSlots({ defs, manifests, runner }, (active) => {
        const context = requireContext(kind, name);
        return kind === 'wallpaper'
          ? { ...active, wallpaper: { id: name, path: context.source } }
          : { ...active, profile: name };
      }, { intent: kind === 'profile' ? 'select-profile' : 'wallpaper' });
    }

    case 'deactivate': {
      const [kind] = rest;
      assertKind(kind);
      return changeSlots({ defs, manifests, runner }, (active) => {
        if (kind === 'wallpaper' && active.wallpaper === undefined) throw new Error('no active wallpaper');
        const next = { ...active };
        delete next[kind];
        return next;
      }, { intent: kind === 'profile' ? 'select-profile' : 'wallpaper' });
    }

    case 'delete': {
      const { args: positional, expected } = parseExpectedSlots(rest);
      const { kind, name } = kindAndName(positional);
      let wasActive = false;
      return changeSlots({ defs, manifests, runner }, (active) => {
        if (readContextText(kind, name) === null) throw new Error(`${kind} ${name}: no such context`);
        wasActive = activeName(active, kind) === name;
        const next = { ...active };
        if (wasActive) delete next[kind];
        return next;
      }, {
        commit: (active) => {
          if (kind === 'profile') deleteContext(kind, name);
          else {
            const look = readLook(active.profile ?? null);
            delete look.wallpapers[name];
            writeLook(active.profile ?? null, look);
          }
          return wasActive;
        },
        intent: kind === 'profile' ? 'delete-profile' : 'delete-wallpaper',
        without: kind === 'wallpaper' ? { kind, name } : null,
        slotBeforeCommit: true,
        expected,
      });
    }

    // Remove the on-screen wallpaper's delta and keep the slot: the wallpaper
    // is active and untuned. The id names what the caller believes is on
    // screen, so a panel drawn before a rotation cannot clear the wrong one.
    case 'clear': {
      const { args: positional, expected } = parseExpectedSlots(rest);
      if (positional[0] !== 'wallpaper') throw usage('clear wallpaper <id>');
      const id = positional[1];
      assertName(id);
      return changeSlots({ defs, manifests, runner }, (active) => {
        requireOnScreen(active, id);
        if (readContextText('wallpaper', id) === null) throw new Error(`wallpaper ${id}: untuned`);
        return active;
      }, {
        commit: () => { deleteContext('wallpaper', id); return true; },
        without: { kind: 'wallpaper', name: id },
        expected,
      });
    }

    // A profile keeps its identity under a new name: the file moves and, when
    // it is the loaded one, the slot follows. Nothing effective changes, so
    // resolved.json and the sinks are never touched. A wallpaper's name is a
    // hash of its path, so it has nothing to rename.
    case 'rename': {
      const { args: positional, expected } = parseExpectedSlots(rest);
      const [kind, from, to] = positional;
      assertKind(kind);
      assertName(from);
      assertName(to);
      if (kind !== 'profile') throw new Error('rename is for profiles; a wallpaper is named by its path');
      await withLock(lockPath(), async () => {
        assertPairLayout();
        const active = readActive();
        assertExpectedSlots(active, expected);
        if (active.profile !== from && active.profile !== to) {
          renameContext(kind, from, to);
          return;
        }
        if (readContextText(kind, from) === null) throw new Error(`profile ${from}: no such context`);
        if (from === to) throw new Error(`profile ${to} already exists`);
        const source = contextPath(kind, from);
        const destination = contextPath(kind, to);
        let next = null;
        try { next = fs.lstatSync(destination); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (next !== null) {
          const old = fs.lstatSync(source);
          if (old.dev !== next.dev || old.ino !== next.ino) throw new Error(`profile ${to} already exists`);
        } else {
          fs.linkSync(source, destination);
        }
        if (active.profile !== to) writeActive({ ...active, profile: to });
        fs.unlinkSync(source);
      });
      emit({ kind, from, to }, '');
      return null;
    }

    // The hook's entry point. The same wallpaper again (a second connector, a
    // re-set) changes nothing; a different one folds scratch into the one
    // that leaves and activates the new one in the same locked step.
    case 'wallpaper': {
      const wallpaper = canonicalWallpaperPath(rest[0]);
      const id = wallpaperId(wallpaper);
      return changeSlots({ defs, manifests, runner }, (active) => (
        active.wallpaper?.id === id ? active : { ...active, wallpaper: { id, path: wallpaper } }), { intent: 'wallpaper' });
    }

    default:
      throw new Error(`prism context ${sub} is declared but not implemented`);
  }
}
