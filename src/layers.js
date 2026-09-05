import { readValues } from './values.js';
import { LAYER_ORDER, readActive, readContext } from './contexts.js';
import { resolveLayered } from './resolve.js';

export function activeName(active, kind) {
  const entry = active[kind];
  if (entry === undefined) return null;
  return kind === 'wallpaper' ? entry.id : entry;
}

export function activeJson(active) {
  return { wallpaper: active.wallpaper ?? null, profile: active.profile ?? null };
}

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

export function writeTarget(layers) {
  const top = layers[layers.length - 1];
  return top ? { kind: top.kind, name: top.name } : { kind: 'base', name: null };
}

export function loadStore(defs) {
  const base = readValues();
  const active = readActive();
  const layers = loadLayers(active);
  const { params, layerOf } = resolveLayered(defs, base, layers);
  const target = writeTarget(layers);
  // What unset would leave: the layer below the target. Below base sit the defaults.
  const below = target.kind === 'base'
    ? resolveLayered(defs, {}, []).params
    : resolveLayered(defs, base, layers.slice(0, -1)).params;
  const fallback = {};
  for (const key of Object.keys(params)) {
    fallback[key] = layerOf[key] === target.kind ? below[key] : params[key];
  }
  return { base, active, layers, target, params, layerOf, fallback };
}
