import { isDeepStrictEqual } from 'node:util';
import { withLock } from './lock.js';
import { lockPath } from './paths.js';
import {
  DELTA_KINDS, LAYER_ORDER, assertName, deleteContext, readContext, writeActive, writeContext,
} from './contexts.js';
import { loadStore, withScratch } from './layers.js';
import { resolveLayered } from './resolve.js';
import { writeScratch } from './scratch.js';
import { writeValues } from './values.js';

const usage = () => new Error('usage: prism commit base | profile [<name>] | wallpaper <id>');

export async function runCommit(args, { defs }) {
  const [destination, ...rest] = args;
  if (!['base', 'profile', 'wallpaper'].includes(destination)) throw usage();
  if ((destination === 'base' && rest.length !== 0)
      || (destination === 'profile' && rest.length > 1)
      || (destination === 'wallpaper' && rest.length !== 1)) throw usage();

  await withLock(lockPath(), async () => {
    const store = loadStore(defs);
    const { active, layers, scratch } = store;
    const keys = Object.keys(scratch);
    const name = rest[0];
    if (name !== undefined) assertName(name);
    if (destination === 'base' && active.profile !== undefined) {
      throw new Error(`profile ${active.profile} is loaded; commit profile, or deactivate it first`);
    }
    if (destination === 'profile' && name === undefined && active.profile === undefined) {
      throw new Error('no profile is loaded; commit profile <name> to save one');
    }
    if (destination === 'wallpaper') {
      if (active.wallpaper === undefined) throw new Error('no active wallpaper');
      if (active.wallpaper.id !== name) throw new Error(`wallpaper ${name} is not on screen`);
    }
    const saveAs = destination === 'profile' && name !== undefined && name !== active.profile;
    if (!saveAs && keys.length === 0) throw new Error('nothing to commit');

    // Compute the complete next store before the first write. Scratch remains
    // on top until the last step, so every write prefix keeps the screen.
    const nextActive = saveAs ? { ...active, profile: name } : active;
    const nextBase = { ...store.base };
    let target = null;
    if (destination === 'base') {
      for (const key of keys) {
        if (isDeepStrictEqual(scratch[key], defs.get(key).default)) delete nextBase[key];
        else nextBase[key] = scratch[key];
      }
    } else if (destination === 'profile') {
      const profileName = saveAs ? name : active.profile;
      target = { kind: 'profile', name: profileName, source: null,
        values: saveAs ? store.params : { ...readContext('profile', profileName).values, ...scratch } };
    } else {
      const old = readContext('wallpaper', name);
      target = { kind: 'wallpaper', name,
        source: old === null ? active.wallpaper.path : old.source,
        values: { ...(old === null ? {} : old.values), ...scratch } };
    }

    const rank = destination === 'base' ? -1 : LAYER_ORDER.indexOf(destination);
    const stripped = layers.filter((layer) => DELTA_KINDS.includes(layer.kind)
      && LAYER_ORDER.indexOf(layer.kind) > rank
      && keys.some((key) => Object.hasOwn(layer.values, key))).map((layer) => {
      const values = { ...layer.values };
      for (const key of keys) delete values[key];
      return { ...layer, source: readContext(layer.kind, layer.name).source, values };
    });
    const nextLayers = layers.map((layer) =>
      stripped.find((entry) => entry.kind === layer.kind && entry.name === layer.name) ?? layer);
    if (target !== null) {
      const index = nextLayers.findIndex((layer) => layer.kind === target.kind);
      if (index >= 0) nextLayers[index] = target;
      else nextLayers.splice(LAYER_ORDER.indexOf(target.kind), 0, target);
    }
    const next = resolveLayered(defs, nextBase, withScratch(nextLayers, {})).params;
    if (!isDeepStrictEqual(next, store.params)) throw new Error('commit would change effective values');

    // Section 8: destination, save-as slot, stripped deltas, cleared scratch.
    if (destination === 'base') writeValues(nextBase);
    else writeContext(target.kind, target.name, target);
    if (saveAs) writeActive(nextActive);
    for (const layer of stripped) {
      if (Object.keys(layer.values).length === 0) deleteContext(layer.kind, layer.name);
      else writeContext(layer.kind, layer.name, layer);
    }
    writeScratch({});
  });
  return 0;
}
