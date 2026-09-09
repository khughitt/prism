import { readValues } from './values.js';
import { LAYER_ORDER, listContexts, readActive, readContext } from './contexts.js';
import { resolveLayered } from './resolve.js';

export function activeName(active, kind) {
  const entry = active[kind];
  if (entry === undefined) return null;
  return kind === 'wallpaper' ? entry.id : entry;
}

export function activeJson(active) {
  const wallpaper = active.wallpaper === undefined
    ? null
    : { id: active.wallpaper.id, path: active.wallpaper.path, pinned: active.wallpaper.pinned === true };
  return { wallpaper, profile: active.profile ?? null };
}

// The full resolution order, low to high: the two implicit layers under the
// context stack, then the context kinds themselves. Clients rank a parameter's
// layer against the write target with this, so adding a kind to LAYER_ORDER
// reaches them without a second list to keep in step.
export const RESOLUTION_ORDER = ['default', 'base', ...LAYER_ORDER];

// The active slots as layers in resolution order. A wallpaper without a file
// is the untuned wallpaper: an empty layer. A profile without a file is broken.
export function loadLayers(active) {
  const layers = [];
  for (const kind of LAYER_ORDER) {
    const name = activeName(active, kind);
    if (name === null) continue;
    const context = readContext(kind, name);
    if (context === null && kind !== 'wallpaper') {
      throw new Error(`${kind} ${name}: active context is missing`);
    }
    layers.push({ kind, name, values: context === null ? {} : context.values });
  }
  return layers;
}

// The write target is the topmost *explicit* layer. A profile is loaded by
// hand, so it is always a target while active. A wallpaper is activated by the
// shell's wallpaper hook without the user asking; it is an overlay that never
// captures edits unless pinned. State (reserved) is automatic too and never a
// target.
export function writeTarget(active) {
  if (active.profile !== undefined) return { kind: 'profile', name: active.profile };
  if (active.wallpaper !== undefined && active.wallpaper.pinned === true) {
    return { kind: 'wallpaper', name: active.wallpaper.id };
  }
  return { kind: 'base', name: null };
}

// The layers strictly below `target`, in resolution order.
export function layersBelow(layers, target) {
  if (target.kind === 'base') return [];
  const rank = LAYER_ORDER.indexOf(target.kind);
  return layers.filter((layer) => LAYER_ORDER.indexOf(layer.kind) < rank);
}

export function loadStore(defs) {
  const base = readValues();
  const active = readActive();
  // Listed in the same locked read as the active slots: a list read separately
  // could disagree with the slot it is drawn beside. Names only -- a profile
  // whose file is broken stays listed and fails when it is activated.
  const profiles = listContexts().profile;
  const layers = loadLayers(active);
  const { params, layerOf } = resolveLayered(defs, base, layers);
  const target = writeTarget(active);
  // What unset would leave: the layers below the target. Below base sit the defaults.
  const below = target.kind === 'base'
    ? resolveLayered(defs, {}, []).params
    : resolveLayered(defs, base, layersBelow(layers, target)).params;
  const fallback = {};
  for (const key of Object.keys(params)) {
    fallback[key] = layerOf[key] === target.kind ? below[key] : params[key];
  }
  return { base, active, profiles, layers, target, params, layerOf, fallback };
}
