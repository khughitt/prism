import { validateValue } from './values.js';
import { writeJsonAtomic } from './store.js';
import { resolvedPath } from './paths.js';

function checkLayer(defs, values, where) {
  for (const key of Object.keys(values)) {
    const def = defs.get(key);
    if (!def) throw new Error(`unknown param ${key} in ${where}`);
    try {
      validateValue(def, values[key]);
    } catch (err) {
      throw new Error(`${where}: ${err.message}`);
    }
  }
}

// layers: [{ kind, name, values }] lowest first. Every layer is validated in
// full, so a bad value shadowed by a higher layer still fails the resolve.
export function resolveLayered(defs, base, layers) {
  checkLayer(defs, base, 'values');
  for (const layer of layers) checkLayer(defs, layer.values, `${layer.kind} ${layer.name}`);
  const params = {};
  const layerOf = {};
  for (const [key, def] of defs) {
    let value = def.default;
    let source = 'default';
    if (key in base) { value = base[key]; source = 'base'; }
    for (const layer of layers) {
      if (key in layer.values) { value = layer.values[key]; source = layer.kind; }
    }
    validateValue(def, value); // the default is the one value no layer check has seen
    params[key] = value;
    layerOf[key] = source;
  }
  return { params, layerOf };
}

export function resolveParams(defs, values) {
  return resolveLayered(defs, values, []).params;
}

export function writeResolved(params) {
  const resolved = { params };
  writeJsonAtomic(resolvedPath(), resolved);
  return resolved;
}
