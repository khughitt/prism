import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The shell's template pipeline rewrites this on every colorscheme change,
// and its wallpaper hook re-applies prism, so an apply always reads the
// current palette.
export function noctaliaColorsPath() {
  return process.env.PRISM_NOCTALIA_COLORS
    ?? path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'noctalia', 'colors.json');
}

// null on a fresh machine, where no colorscheme has been generated yet: the
// ring then rests on the manual color. A file that exists but does not parse
// or carries no usable primary is an error — the user chose this source, and
// a broken one must fail the apply rather than silently freeze the ring.
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
  const accent = colors?.mPrimary;
  if (typeof accent !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accent)) {
    throw new Error(`${file}: mPrimary missing or not a #rrggbb color`);
  }
  return accent;
}
