import fs from 'node:fs';
import { stringify } from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import { withLock } from './lock.js';
import { lockPath } from './paths.js';
import {
  VERB_KINDS, assertKind, assertName, contextPath, deleteContext, inspectContext, listContexts, readActive, readContext,
  readContextText, renameContext, wallpaperId, canonicalWallpaperPath, writeActive, readLook, readRuntime, writeLook, writeRuntime,
} from './contexts.js';
import { activeName, loadLayers, withScratch } from './layers.js';
import { readScratch } from './scratch.js';
import { checkLayer, resolveLayered, writeResolved } from './resolve.js';
import { fanOut } from './fanout.js';
import { assertPairLayout, pairLayoutSources } from './migrate.js';

function usage(text) {
  return new Error(`usage: prism context ${text}`);
}

function requireContext(kind, name) {
  const context = readContext(kind, name);
  if (context === null) throw new Error(`${kind} ${name}: no such context`);
  return context;
}

function kindAndName(rest, verb) {
  if (rest.length !== 2) throw usage(`${verb} <kind> <name>`);
  const [kind, name] = rest;
  assertKind(kind);
  assertName(name);
  return { kind, name };
}

// Resolve and validate both sides before mutation. Only a named outgoing look
// can fail during explicit selection/recovery; base and scratch never share that catch.
async function changeSlots({ defs, manifests, runner }, mutate,
  { commit = () => false, intent = 'wallpaper', without = null, slotBeforeCommit = false } = {}) {
  let outcome = null;
  await withLock(lockPath(), async () => {
    assertPairLayout();
    const { active, scratch } = readRuntime();
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
    const wallpaperChanged = active.wallpaper?.id !== next.wallpaper?.id;
    const saveOutgoing = !recoverOutgoing && active.wallpaper !== undefined
      && (selectLook || (intent === 'wallpaper' && wallpaperChanged));
    const scratchAfter = recoverOutgoing ? scratch : (selectLook || saveOutgoing ? {} : scratch);
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
    const { params } = resolveLayered(defs, base, withScratch(loadLayers(next, incomingLook), scratchAfter));
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
  if (outcome === null || outcome.changedKeys.length === 0) return null;
  return fanOut({ manifests, resolved: outcome.resolved, changedKeys: outcome.changedKeys, runner });
}

function requireOnScreen(active, id) {
  if (active.wallpaper === undefined) throw new Error('no active wallpaper');
  if (active.wallpaper.id !== id) throw new Error(`wallpaper ${id} is not on screen`);
}

// Returns a fan-out result, or null when nothing reached the bus.
export async function runContext(args, { defs, manifests, print, eprint, runner }) {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'list': {
      if (rest.length !== 0) throw usage('list');
      const { active, all, inspected, scratch } = await withLock(lockPath(), async () => {
        for (const source of pairLayoutSources()) print(`! old pair layout: ${source} — run 'prism migrate pairs'\n`);
        const listed = listContexts();
        listed.wallpaper = Object.keys(readLook(readActive().profile ?? null)?.wallpapers ?? {}).sort();
        return {
          active: readActive(),
          all: listed,
          inspected: Object.fromEntries(VERB_KINDS.map((kind) => [kind,
            Object.fromEntries(listed[kind].map((name) => [name, inspectContext(kind, name)]))])),
          scratch: readScratch(),
        };
      });
      for (const kind of VERB_KINDS) {
        const current = activeName(active, kind);
        for (const name of all[kind]) {
          const entry = inspected[kind][name];
          if (entry === null) continue; // removed between the listing and the read
          if (entry.error !== null) {
            print(`! ${kind} ${name}  ${entry.error} — run 'prism doctor'\n`);
            continue;
          }
          const marker = name === current ? '*' : ' ';
          const source = kind === 'wallpaper' ? `  ${entry.context.source}` : '';
          print(`${marker} ${kind} ${name}${source}\n`);
        }
      }
      if (active.wallpaper && !all.wallpaper.includes(active.wallpaper.id)) {
        print(`* wallpaper ${active.wallpaper.id}  ${active.wallpaper.path} (untuned)\n`);
      }
      const edits = Object.keys(scratch).length;
      if (edits > 0) print(`  scratch  ${edits} ${edits === 1 ? 'edit' : 'edits'}\n`);
      return null;
    }

    // Showing the file is what was asked for, so a file that does not parse is
    // printed as it is, with the reason on stderr.
    case 'show': {
      const { kind, name } = kindAndName(rest, 'show');
      const entry = await withLock(lockPath(), async () => {
        for (const source of pairLayoutSources()) eprint(`prism: old pair layout: ${source} — run 'prism migrate pairs'\n`);
        return inspectContext(kind, name);
      });
      if (entry === null) throw new Error(`${kind} ${name}: no such context`);
      if (entry.error !== null) {
        print(entry.text);
        eprint(`prism: ${kind} ${name}: ${entry.error} — run 'prism doctor'\n`);
        return null;
      }
      const { context } = entry;
      const doc = kind === 'wallpaper' ? { _source: context.source, ...context.values } : context.values;
      print(stringify(doc));
      return null;
    }

    case 'activate': {
      const { kind, name } = kindAndName(rest, 'activate');
      return changeSlots({ defs, manifests, runner }, (active) => {
        const context = requireContext(kind, name);
        return kind === 'wallpaper'
          ? { ...active, wallpaper: { id: name, path: context.source } }
          : { ...active, profile: name };
      }, { intent: kind === 'profile' ? 'select-profile' : 'wallpaper' });
    }

    case 'deactivate': {
      if (rest.length !== 1) throw usage('deactivate <kind>');
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
      const { kind, name } = kindAndName(rest, 'delete');
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
      });
    }

    // Remove the on-screen wallpaper's delta and keep the slot: the wallpaper
    // is active and untuned. The id names what the caller believes is on
    // screen, so a panel drawn before a rotation cannot clear the wrong one.
    case 'clear': {
      if (rest.length !== 2 || rest[0] !== 'wallpaper') throw usage('clear wallpaper <id>');
      const id = rest[1];
      assertName(id);
      return changeSlots({ defs, manifests, runner }, (active) => {
        requireOnScreen(active, id);
        if (readContextText('wallpaper', id) === null) throw new Error(`wallpaper ${id}: untuned`);
        return active;
      }, {
        commit: () => { deleteContext('wallpaper', id); return true; },
        without: { kind: 'wallpaper', name: id },
      });
    }

    // A profile keeps its identity under a new name: the file moves and, when
    // it is the loaded one, the slot follows. Nothing effective changes, so
    // resolved.json and the sinks are never touched. A wallpaper's name is a
    // hash of its path, so it has nothing to rename.
    case 'rename': {
      if (rest.length !== 3) throw usage('rename <kind> <old> <new>');
      const [kind, from, to] = rest;
      assertKind(kind);
      assertName(from);
      assertName(to);
      if (kind !== 'profile') throw new Error('rename is for profiles; a wallpaper is named by its path');
      await withLock(lockPath(), async () => {
        assertPairLayout();
        const active = readActive();
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
      return null;
    }

    // The hook's entry point. The same wallpaper again (a second connector, a
    // re-set) changes nothing; a different one folds scratch into the one
    // that leaves and activates the new one in the same locked step.
    case 'wallpaper': {
      if (rest.length !== 1) throw usage('wallpaper <path>');
      const wallpaper = canonicalWallpaperPath(rest[0]);
      const id = wallpaperId(wallpaper);
      return changeSlots({ defs, manifests, runner }, (active) => (
        active.wallpaper?.id === id ? active : { ...active, wallpaper: { id, path: wallpaper } }), { intent: 'wallpaper' });
    }

    default:
      throw usage('list|show|rename|activate|deactivate|delete|clear|wallpaper');
  }
}
