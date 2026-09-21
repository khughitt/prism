import { isDeepStrictEqual } from 'node:util';
import { withLock } from './lock.js';
import { lockPath } from './paths.js';
import { assertName, readLook, writeLook, writeRuntime, parseExpectedSlots, assertExpectedSlots, readRuntime } from './contexts.js';
import { loadLayers, loadStore } from './layers.js';
import { resolveLayered } from './resolve.js';

const usage = () => new Error('usage: prism commit base | profile [<name>] | wallpaper <id>');

// Returns { destination, name, keys }: the look written and the scratch keys it took.
export async function runCommit(args, { defs }) {
  const { args: positional, expected } = parseExpectedSlots(args);
  const [destination, ...rest] = positional;
  if (!['base', 'profile', 'wallpaper'].includes(destination)) throw usage();
  if ((destination === 'base' && rest.length !== 0)
      || (destination === 'profile' && rest.length > 1)
      || (destination === 'wallpaper' && rest.length !== 1)) throw usage();

  let committed = null;
  await withLock(lockPath(), async () => {
    assertExpectedSlots(readRuntime().active, expected);
    const store = loadStore(defs);
    const { active, scratch } = store;
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
    const selected = saveAs ? name : active.profile ?? null;
    const look = readLook(selected) ?? { values: {}, wallpapers: {} };
    const id = active.wallpaper?.id;
    if (saveAs) {
      look.values = { ...store.params };
      if (id !== undefined) delete look.wallpapers[id];
    } else if (destination === 'wallpaper') {
      const old = Object.hasOwn(look.wallpapers, id) ? look.wallpapers[id] : null;
      look.wallpapers = { ...look.wallpapers, [id]: { source: old?.source ?? active.wallpaper.path, values: { ...old?.values, ...scratch } } };
    } else {
      for (const key of keys) {
        if (selected === null && isDeepStrictEqual(scratch[key], defs.get(key).default)) delete look.values[key];
        else look.values[key] = scratch[key];
      }
      if (id !== undefined && Object.hasOwn(look.wallpapers, id)) {
        for (const key of keys) delete look.wallpapers[id].values[key];
        if (Object.keys(look.wallpapers[id].values).length === 0) delete look.wallpapers[id];
      }
    }
    const nextActive = saveAs ? { ...active, profile: name } : active;
    const next = resolveLayered(defs, selected === null ? look.values : store.base, loadLayers(nextActive, look)).params;
    if (!isDeepStrictEqual(next, store.params)) throw new Error('commit would change effective values');
    writeLook(selected, look);
    writeRuntime({ active: nextActive, scratch: {} });
    committed = { destination, name: destination === 'base' ? null : destination === 'wallpaper' ? id : selected, keys };
  });
  return committed;
}
