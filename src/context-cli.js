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
      const { active, all, inspected, pairs, errors, scratch } = await withLock(lockPath(), async () => {
        for (const source of pairLayoutSources()) print(`! old pair layout: ${source} — run 'prism migrate pairs'\n`);
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
      for (const name of all.profile) {
        const entry = inspected[name];
        if (entry === null) continue;
        if (entry.error !== null) print(`! profile ${name}  ${entry.error} — run 'prism doctor'\n`);
        else print(`${name === active.profile ? '*' : ' '} profile ${name}\n`);
      }
      for (const error of errors) {
        if (error.look === null) print(`! look default  ${error.message} — run 'prism doctor'\n`);
      }
      for (const pair of pairs) {
        const token = pair.look === null ? 'default' : `profile:${pair.look}`;
        const marker = pair.look === (active.profile ?? null) && pair.id === active.wallpaper?.id ? '*' : ' ';
        print(`${marker} wallpaper ${token} ${pair.id}  ${pair.source}\n`);
      }
      if (active.wallpaper && !errors.some((error) => error.look === (active.profile ?? null))
          && !pairs.some((pair) => pair.look === (active.profile ?? null) && pair.id === active.wallpaper.id)) {
        const token = active.profile === undefined ? 'default' : `profile:${active.profile}`;
        print(`* wallpaper ${token} ${active.wallpaper.id}  ${active.wallpaper.path} (untuned)\n`);
      }
      const edits = Object.keys(scratch).length;
      if (edits > 0) print(`  scratch  ${edits} ${edits === 1 ? 'edit' : 'edits'}\n`);
      return null;
    }

    // Showing the file is what was asked for, so a file that does not parse is
    // printed as it is, with the reason on stderr.
    case 'show': {
      const lookFlag = rest[2] === '--look' && rest.length === 4;
      const { kind, name } = kindAndName(lookFlag ? rest.slice(0, 2) : rest, 'show');
      let look;
      if (lookFlag) {
        if (kind !== 'wallpaper') throw usage('show wallpaper <id> [--look <look-token>]');
        look = parseLookToken(rest[3]);
      }
      const { entry, profileDoc } = await withLock(lockPath(), async () => {
        for (const source of pairLayoutSources()) eprint(`prism: old pair layout: ${source} — run 'prism migrate pairs'\n`);
        const selectedLook = lookFlag ? look : readActive().profile ?? null;
        const entry = inspectContext(kind, name, selectedLook);
        return { entry, profileDoc: kind === 'profile' && entry?.error === null ? readLook(name) : null };
      });
      if (entry === null) throw new Error(`${kind} ${name}: no such context`);
      if (entry.error !== null) {
        print(entry.text);
        eprint(`prism: ${kind} ${name}: ${entry.error} — run 'prism doctor'\n`);
        return null;
      }
      const { context } = entry;
      const doc = kind === 'wallpaper' ? { _source: context.source, ...context.values } :
        { ...profileDoc.values, ...(Object.keys(profileDoc.wallpapers).length ? { _wallpapers: Object.fromEntries(
          Object.entries(profileDoc.wallpapers).map(([id, pair]) => [id, { _source: pair.source, ...pair.values }])) } : {}) };
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
      const { args: positional, expected } = parseExpectedSlots(rest);
      const { kind, name } = kindAndName(positional, 'delete');
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
      if (positional.length !== 2 || positional[0] !== 'wallpaper') throw usage('clear wallpaper <id>');
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
      if (positional.length !== 3) throw usage('rename <kind> <old> <new>');
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
