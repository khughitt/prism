import { isDeepStrictEqual } from 'node:util';
import { validateValue } from './values.js';

export const MODES = ['defaults', 'symmetric', 'neutral'];

const isVisible = (def) => def.ui.control !== 'none';

export function visibleGroups(defs) {
  const groups = new Set();
  for (const def of defs.values()) if (isVisible(def)) groups.add(def.ui.group);
  return groups;
}

function scopeOf(defs, group) {
  const scoped = [...defs.values()].filter(isVisible);
  return group === null ? scoped : scoped.filter((def) => def.ui.group === group);
}

function pairsOf(scoped) {
  const rows = new Map();
  for (const def of scoped) {
    if (def.ui.state === undefined) continue;
    const id = `${def.ui.group}\u0000${def.ui.row}`;
    const row = rows.get(id) ?? {};
    row[def.ui.state] = def;
    rows.set(id, row);
  }
  return [...rows.values()].filter((row) => row.focused !== undefined && row.unfocused !== undefined);
}

export function planReset({ defs, mode, group, held, effective, normalizeToDefault }) {
  const scoped = scopeOf(defs, group);
  const values = { ...held };

  const put = (def, value) => {
    validateValue(def, value);
    if (normalizeToDefault && isDeepStrictEqual(value, def.default)) delete values[def.key];
    else values[def.key] = value;
  };

  if (mode === 'defaults') {
    for (const def of scoped) delete values[def.key];
  } else if (mode === 'neutral') {
    for (const def of scoped) {
      if (def.neutralize === false) continue;
      if (isDeepStrictEqual(effective[def.key], def.neutral)) continue;
      put(def, def.neutral);
    }
  } else {
    for (const row of pairsOf(scoped)) {
      const value = effective[row.focused.key];
      if (isDeepStrictEqual(effective[row.unfocused.key], value)) continue;
      put(row.unfocused, value);
    }
  }

  const changedKeys = [];
  for (const key of new Set([...Object.keys(held), ...Object.keys(values)])) {
    if (!isDeepStrictEqual(held[key], values[key])) changedKeys.push(key);
  }
  return { values, changedKeys };
}
