import fs from 'node:fs';
import path from 'node:path';
import { stateDir } from '../../src/paths.js';

// Noctalia renders noctalia-palette.template here on every palette change
// (a user template in the Noctalia config), and its colors_changed hook then
// runs `prism apply niri`, so an apply always reads the current palette.
export function noctaliaColorsPath() {
  return process.env.PRISM_NOCTALIA_COLORS ?? path.join(stateDir(), 'noctalia-palette.json');
}

// null on a machine where the template has not rendered yet: the ring then
// rests on the manual color. A file that exists but does not parse or carries
// no usable primary is an error — the user chose this source, and a broken
// one must fail the apply rather than silently freeze the ring.
export function readNoctaliaAccent(file) {
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
    throw new Error(`${file}: not valid JSON`);
  }
  const accent = colors?.primary;
  if (typeof accent !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accent)) {
    throw new Error(`${file}: primary missing or not a #rrggbb color`);
  }
  return accent;
}
