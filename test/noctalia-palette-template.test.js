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
  // Fixed dark/light palettes need neither an image nor a running shell.
  const tokens = {
    dark: { primary: '#a1b2c3', surface: '#111317' },
    light: { primary: '#445566', surface: '#fafafa' },
  };
  fs.writeFileSync(theme, JSON.stringify(tokens));
  for (const mode of ['dark', 'light']) {
    execFileSync('noctalia', ['theme', '--theme-json', theme,
      '--default-mode', mode, '-r', `${template}:${out}`], { stdio: 'pipe' });
    assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), tokens[mode]);
    assert.equal(readNoctaliaAccent(out), tokens[mode].primary,
      'the existing ring reader accepts the expanded output');
  }
});
