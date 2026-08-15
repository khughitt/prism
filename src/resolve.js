import { validateValue } from './values.js';
import { writeJsonAtomic } from './store.js';
import { resolvedPath } from './paths.js';

export function resolveParams(defs, values) {
  for (const key of Object.keys(values)) {
    if (!defs.has(key)) throw new Error(`unknown param ${key} in values`);
  }
  const params = {};
  for (const [key, def] of defs) {
    const value = key in values ? values[key] : def.default;
    validateValue(def, value);
    params[key] = value;
  }
  return params;
}

export function writeResolved(defs, values) {
  const resolved = { params: resolveParams(defs, values) };
  writeJsonAtomic(resolvedPath(), resolved);
  return resolved;
}
