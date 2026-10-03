import fs from 'node:fs';
import path from 'node:path';
import { effectiveDir } from './paths.js';
import { validateValue } from './values.js';

// A sink that resolves a value from outside the store (a palette, a session
// hue) reports what it installed, one file per sink. describe joins them onto
// the params so the panel can show the color in force where the stored one is
// not. A report that cannot be read fails describe: a wrong swatch is worse
// than an error naming the file. Each value is checked by the def of the key it
// reports, with the store's own validator.
export function readEffective(defs, dir = effectiveDir()) {
  let names;
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
  const byKey = new Map();
  const owner = new Map();
  for (const name of names) {
    const file = path.join(dir, name);
    let report;
    try {
      report = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      throw new Error(`${file}: not valid JSON`);
    }
    if (typeof report !== 'object' || report === null || Array.isArray(report)) {
      throw new Error(`${file}: expected an object of reported values`);
    }
    for (const [key, entry] of Object.entries(report)) {
      if (typeof entry?.value !== 'string' || typeof entry?.from !== 'string') {
        throw new Error(`${file}: ${key} needs a string value and from`);
      }
      const def = defs.get(key);
      if (def === undefined) throw new Error(`${file}: reports ${key}, which no def declares`);
      try {
        validateValue(def, entry.value);
      } catch (error) {
        throw new Error(`${file}: ${error.message}`);
      }
      if (owner.has(key)) throw new Error(`${key} is reported by both ${owner.get(key)} and ${name}`);
      owner.set(key, name);
      byKey.set(key, { value: entry.value, from: entry.from });
    }
  }
  return byKey;
}
