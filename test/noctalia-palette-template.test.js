import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readNoctaliaAccent } from '../integrations/niri/palette.js';

const template = fileURLToPath(new URL('../integrations/niri/noctalia-palette.template', import.meta.url));

function hasNoctalia() {
  try { execFileSync('noctalia', ['--version'], { stdio: 'pipe' }); return true; } catch { return false; }
}

test('the template renders a palette the niri sink accepts', { skip: hasNoctalia() ? false : 'noctalia is not installed' }, (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-template-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'noctalia-palette.json');
  const theme = path.join(dir, 'theme.json');
  // A fixed palette, so the render needs no image and no running shell.
  fs.writeFileSync(theme, JSON.stringify({ dark: { primary: '#a1b2c3' }, light: { primary: '#a1b2c3' } }));
  execFileSync('noctalia', ['theme', '--theme-json', theme, '-r', `${template}:${out}`], { stdio: 'pipe' });
  assert.equal(readNoctaliaAccent(out).toLowerCase(), '#a1b2c3');
});
