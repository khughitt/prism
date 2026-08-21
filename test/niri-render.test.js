import test from 'node:test';
import assert from 'node:assert/strict';
import { renderNiriFragment } from '../integrations/niri/render.js';

const resolved = { params: {
  'compositor.gaps': 10,
  'terminal.apps': ['kitty', 'ghostty'],
  'terminal.window.opacity.active': 0.98,
  'terminal.window.opacity.inactive': 0.95,
  'terminal.blur': true,
  'terminal.saturation.active': 1,
  'terminal.saturation.inactive': 0.85,
  'terminal.noise.active': 0.1,
  'terminal.noise.inactive': 0.01,
} };

test('fragment carries gaps and the authoritative active and inactive rules per app', () => {
  const kdl = renderNiriFragment(resolved);

  assert.match(kdl, /layout \{\n    gaps 10\n\}/);
  assert.equal(kdl.match(/window-rule \{/g)?.length, 4);
  assert.match(kdl, /match app-id="kitty" is-active=true\n    opacity 0\.98\n    background-effect \{\n        blur true\n        xray false\n        saturation 1\n        noise 0\.1/);
  assert.match(kdl, /match app-id="kitty" is-active=false\n    opacity 0\.95\n    background-effect \{\n        blur true\n        xray false\n        saturation 0\.85\n        noise 0\.01/);
  assert.match(kdl, /match app-id="ghostty" is-active=true/);
  assert.match(kdl, /match app-id="ghostty" is-active=false/);
});

test('app ids cannot inject KDL', () => {
  const kdl = renderNiriFragment({
    params: { ...resolved.params, 'terminal.apps': ['odd"\\\napp'] },
  });

  assert.ok(kdl.includes('match app-id="odd\\"\\\\\\napp" is-active=true'));
  assert.equal(kdl.match(/window-rule \{/g)?.length, 2);
});

test('disabled blur omits blur while retaining the other background effects', () => {
  const kdl = renderNiriFragment({
    params: { ...resolved.params, 'terminal.blur': false },
  });

  assert.doesNotMatch(kdl, /\bblur true\b/);
  assert.match(kdl, /background-effect \{\n        xray false\n        saturation 1\n        noise 0\.1\n    \}/);
});

test('whole-number opacity remains a KDL float', () => {
  const kdl = renderNiriFragment({
    params: { ...resolved.params, 'terminal.window.opacity.active': 1 },
  });

  assert.match(kdl, /match app-id="kitty" is-active=true\n    opacity 1\.0\n/);
});

test('fragment is stable', () => {
  assert.equal(renderNiriFragment(resolved), renderNiriFragment(resolved));
});
