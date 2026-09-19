import { readValues } from './values.js';
import { LAYER_ORDER, listContexts, readActive, readContext } from './contexts.js';
import { readScratch } from './scratch.js';
import { resolveLayered } from './resolve.js';

export function activeName(active, kind) {
  const entry = active[kind];
  if (entry === undefined) return null;
  return kind === 'wallpaper' ? entry.id : entry;
}

export function activeJson(active) {
  const wallpaper = active.wallpaper === undefined
    ? null
    : { id: active.wallpaper.id, path: active.wallpaper.path };
  return { wallpaper, profile: active.profile ?? null };
}

// The full resolution order, low to high: the two implicit layers under the
// context stack, the context kinds, then scratch. Clients read this rather
// than carrying a copy, so adding a kind reaches them without a second list.
export const RESOLUTION_ORDER = ['default', 'base', ...LAYER_ORDER, 'scratch'];

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

// Scratch is always the topmost layer and the only one that takes edits.
export function withScratch(layers, scratch) {
  return [...layers, { kind: 'scratch', name: null, values: scratch }];
}

export function loadStore(defs) {
  const base = readValues();
  const active = readActive();
  // Listed in the same locked read as the active slots: a list read separately
  // could disagree with the slot it is drawn beside. Names only -- a profile
  // whose file is broken stays listed and fails when it is activated.
  const profiles = listContexts().profile;
  const layers = loadLayers(active);
  const scratch = readScratch();
  const { params, layerOf } = resolveLayered(defs, base, withScratch(layers, scratch));
  // The fold beneath scratch: what a revert reveals, and what a set normalizes against.
  const beneath = resolveLayered(defs, base, layers).params;
  const held = {};
  const fallback = {};
  for (const key of Object.keys(params)) {
    held[key] = [];
    if (Object.hasOwn(base, key)) held[key].push('base');
    for (const layer of layers) if (Object.hasOwn(layer.values, key)) held[key].push(layer.kind);
    if (Object.hasOwn(scratch, key)) held[key].push('scratch');
    fallback[key] = Object.hasOwn(scratch, key) ? beneath[key] : params[key];
  }
  return { base, active, profiles, layers, scratch, params, layerOf, beneath, held, fallback };
}
