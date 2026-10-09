import fs from 'node:fs';
import path from 'node:path';
import { stateDir } from '../../src/paths.js';

// Noctalia renders noctalia-palette.template here on every palette change
// (a user template in the Noctalia config), and its colors_changed hook then
// runs `prism apply niri`, so an apply always reads the current palette.
export function noctaliaColorsPath() {
  return process.env.PRISM_NOCTALIA_COLORS ?? path.join(stateDir(), 'noctalia-palette.json');
}

// Read once and validate only the fields the enabled consumers need.
// A missing palette is allowed only when the ring is its sole consumer.
export function readNoctaliaPalette(file, requiredFields, consumer = 'ring') {
  const remedy = consumer === 'tint'
    ? "run 'noctalia msg templates-apply', verify primary and surface, then rerun 'prism apply niri'; see the README for direct wallpaper refresh or select manual or familiar tint"
    : "run 'noctalia msg templates-apply', verify primary, then rerun 'prism apply niri' or select the ring's manual Color source";
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  let colors;
  try {
    colors = JSON.parse(text);
  } catch {
    throw new Error(`${file}: not valid JSON — ${remedy}`);
  }
  return Object.fromEntries(requiredFields.map((field) => {
    const value = colors?.[field];
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
      throw new Error(`${file}: ${field} missing or not a #rrggbb color — ${remedy}`);
    }
    return [field, value];
  }));
}
