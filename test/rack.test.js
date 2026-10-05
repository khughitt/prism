import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { loadDefs } from '../src/defs.js';
import { loadRack, validateRack, familyOf } from '../src/rack.js';
import { loadPipeline, validatePipeline } from '../src/pipeline.js';
import { loadDry } from '../src/dry.js';
import { loadManifests } from '../src/manifest.js';
import { nodeMap } from '../src/nodes.js';
import { defsDir, integrationsDir } from '../src/paths.js';

// A small group with two matrix rows, one shared select, one header toggle,
// and two bypass toggles, so every validation rule has something to bite.
const DEFS = `
- {key: t.on, type: bool, default: true, neutral: true, ui: {group: Title, control: toggle, label: On, order: 0}, description: d}
- {key: r.split, type: bool, default: true, neutral: true, ui: {group: R, control: toggle, label: Split, order: 1, header: true}, description: d}
- {key: r.blur, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Blur, order: 2, state: focused, row: Blur}, description: d}
- {key: r.inactive.blur, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Unfocused blur, order: 3, state: unfocused, row: Blur}, description: d}
- {key: r.depth, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Depth, order: 4, state: focused, row: Depth}, description: d}
- {key: r.inactive.depth, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Unfocused depth, order: 5, state: unfocused, row: Depth}, description: d}
- {key: r.kind, type: enum, values: [a, b], default: a, neutral: a, ui: {group: R, control: select, label: Kind, order: 6}, description: d}
- {key: r.bypass.one, type: bool, default: false, neutral: false, ui: {group: R, control: toggle, label: Bypass one, order: 7}, description: d}
- {key: r.bypass.two, type: bool, default: false, neutral: false, ui: {group: R, control: toggle, label: Bypass two, order: 8}, description: d}
- {key: r.amount, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Amount, order: 9}, description: d}
- {key: r.gain, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Gain, order: 10, state: focused, row: Gain}, description: d}
- {key: r.inactive.gain, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Unfocused gain, order: 11, state: unfocused, row: Gain}, description: d}
- {key: r.bypass.three, type: bool, default: false, neutral: false, ui: {group: R, control: toggle, label: Bypass three, order: 12}, description: d}
- {key: g.gap, type: int, range: [0, 9], default: 1, neutral: 1, ui: {group: G, control: slider, step: 1, label: Gap, order: 13}, description: d}
`;

function defsFrom(yamlText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-rack-'));
  fs.writeFileSync(path.join(dir, 'a.yaml'), yamlText);
  return loadDefs(dir);
}

const defs = defsFrom(DEFS);

// A two-site schema on real site ids (familyOf knows only those): `one`,
// `two`, and `three` are devices at behind, a sequence site; `four` owns gap
// at within and is a shared stage (g.gap is in group G, so no device can
// carry it).
const SCHEMA = () => validatePipeline({
  version: 1,
  sites: [
    { id: 'behind', carrier: 'linear', law: 'sequence', orderable: false, coverage: 'glass', cost: 'fragment' },
    { id: 'within', carrier: 'light', law: 'sum', orderable: false, coverage: 'glass', cost: 'fragment' },
  ],
  stages: [
    { id: 'one', site: 'behind', scope: 'material', owns: ['blur', 'kind'], reads: ['blur', 'kind'], responses: [], animated: false },
    { id: 'two', site: 'behind', scope: 'material', owns: ['depth', 'amount='], reads: ['depth', 'amount=', 'blur'], responses: [], animated: false },
    { id: 'three', site: 'behind', scope: 'material', owns: ['gain'], reads: ['gain'], responses: [], animated: false },
    { id: 'four', site: 'within', scope: 'output', owns: ['gap'], reads: ['gap'], responses: [], animated: false },
  ],
  interactions: [
    { kind: 'attenuates', from: 'one', on: 'two', why: 'blur scales depth [expose]' },
  ],
});
const NODES = new Map([
  ['r.blur', 'blur'], ['r.inactive.blur', 'blur'], ['r.depth', 'depth'], ['r.inactive.depth', 'depth'],
  ['r.kind', 'kind'], ['r.amount', 'amount='], ['r.gain', 'gain'], ['r.inactive.gain', 'gain'], ['g.gap', 'gap'],
]);
// A dry entry as src/dry.js merges it: the fields under the sink that declared
// them. Device one's dry entry zeroes depth, which device two's mix writes:
// two requires one.
const entry = (fields) => ({ sink: 'a', fields });
const DRY = { 'r.bypass.one': entry({ blur: 0, depth: 0 }), 'r.bypass.two': entry({ depth: 0 }), 'r.bypass.three': entry({ gain: 0 }) };

const complete = () => ({ group: 'R', shared: ['four'], devices: [
  { device: 'one', label: 'One', stage: 'one', mix: 'Blur', rows: [], shared: ['r.kind'], bypass: 'r.bypass.one' },
  { device: 'two', label: 'Two', stage: 'two', mix: 'Depth', rows: [], shared: ['r.amount'], bypass: 'r.bypass.two' },
  { device: 'three', label: 'Three', stage: 'three', mix: 'Gain', rows: [], shared: [], bypass: 'r.bypass.three' },
] });

test('a complete rack validates and comes back resolved', () => {
  const rack = validateRack(complete(), defs, SCHEMA(), DRY, NODES);
  assert.deepEqual(rack.shared, ['four']);
  const [one, two, three] = rack.devices;
  assert.deepEqual([one.site, one.scope, one.family], ['behind', 'material', 'transmission']);
  assert.equal(Object.hasOwn(one, 'requires'), false);
  assert.deepEqual(one.interactions, []);
  assert.equal(two.requires, 'one');
  assert.deepEqual(two.interactions, [
    { kind: 'attenuates', device: 'one', why: 'blur scales depth [expose]', source: 'schema' },
    { kind: 'requires', device: 'one', why: 'the r.bypass.one dry entry writes depth', source: 'dry' },
  ]);
  assert.equal(Object.hasOwn(three, 'requires'), false, 'a device is not required by its own dry entry');
  assert.deepEqual(three.interactions, []);
});

test('the shipped rack loads against the shipped defs, schema, and dry file', () => {
  const shippedDefs = loadDefs(defsDir());
  const rack = loadRack(defsDir(), shippedDefs, {
    dry: loadDry(integrationsDir()), nodes: nodeMap(loadManifests(integrationsDir(), shippedDefs)),
  });
  assert.equal(rack.group, 'Focus');
  assert.deepEqual(rack.shared, ['slab', 'ripple', 'ring']);
  assert.deepEqual(rack.devices.map((d) => d.device), [
    'backdrop', 'distortion', 'refraction', 'fringing', 'directionalBlur', 'saturation', 'noise', 'tint', 'aurora', 'iridescence',
  ]);
  assert.deepEqual(rack.devices.filter((d) => d.requires).map((d) => [d.device, d.requires]),
    [['fringing', 'refraction'], ['directionalBlur', 'refraction']]);
  const backdrop = rack.devices[0];
  assert.deepEqual([backdrop.stage, backdrop.site, backdrop.scope, backdrop.family], ['prefilter', 'source', 'material', 'source']);
  assert.deepEqual(backdrop.interactions.map((i) => [i.kind, i.device, i.source]), [['attenuates', 'refraction', 'schema']]);
  assert.deepEqual(rack.devices.map((d) => d.family), [
    'source', 'geometry', 'transmission', 'transmission', 'transmission', 'transmission', 'transmission',
    'transmission', 'light', 'light',
  ]);
  assert.deepEqual(rack.devices.find((d) => d.device === 'tint').shared, ['glass.tintSource', 'glass.tintAccentMix']);
  assert.equal(rack.devices.some((d) => 'category' in d), false);
});

test('the drift case: a vendored schema that swaps the two behind optics fails the shipped rack load naming both devices', () => {
  // The spec's acceptance (Section 6): the shipped devices.yaml against the
  // shipped pipeline.json with saturation and noise swapped, as a regenerated
  // schema from a renderer whose ORDER moved them would read.
  const shippedDefs = loadDefs(defsDir());
  const schema = JSON.parse(fs.readFileSync(path.join(defsDir(), 'rack', 'pipeline.json'), 'utf8'));
  const at = (id) => schema.stages.findIndex((s) => s.id === id);
  const [saturation, noise] = [at('saturation'), at('noise')];
  assert.ok(saturation !== -1 && noise !== -1 && saturation < noise, 'the shipped schema orders saturation before noise');
  [schema.stages[saturation], schema.stages[noise]] = [schema.stages[noise], schema.stages[saturation]];
  const swapped = validatePipeline(schema);
  const rack = parse(fs.readFileSync(path.join(defsDir(), 'rack', 'devices.yaml'), 'utf8'));
  const dry = loadDry(integrationsDir());
  const nodes = nodeMap(loadManifests(integrationsDir(), shippedDefs));
  assert.throws(() => validateRack(rack, shippedDefs, swapped, dry, nodes),
    /device noise: out of stage order; stage noise precedes stage saturation in the schema/);
  // The same inputs against the shipped schema still load: the swap is the whole difference.
  assert.doesNotThrow(() => validateRack(rack, shippedDefs, loadPipeline(defsDir()), dry, nodes));
});

test('families follow the site', () => {
  assert.equal(familyOf('source'), 'source');
  assert.equal(familyOf('normal'), 'geometry');
  for (const s of ['taps', 'behind', 'attenuation']) assert.equal(familyOf(s), 'transmission');
  for (const s of ['within', 'specular', 'emissive']) assert.equal(familyOf(s), 'light');
  assert.equal(familyOf('post'), 'post');
  assert.throws(() => familyOf('encode'), /site encode has no family; no device may sit there/);
});

test('loadDefs still loads with the rack directory beside the def files', () => {
  const shipped = loadDefs(defsDir());
  assert.ok(shipped.has('glass.bypass.noise'));
  assert.ok(fs.existsSync(path.join(defsDir(), 'rack', 'devices.yaml')));
  assert.ok(fs.existsSync(path.join(defsDir(), 'rack', 'pipeline.json')));
});

test('a row with two parameters of one state is rejected before a device can claim it', () => {
  const doubled = defsFrom(DEFS + `- {key: r.blur2, type: float, range: [0, 1], default: 0, neutral: 0, ui: {group: R, control: slider, step: 0.1, label: Blur again, order: 14, state: focused, row: Blur}, description: d}\n`);
  assert.throws(() => validateRack(complete(), doubled, SCHEMA(), DRY, NODES), /row Blur in group R has two focused parameters/);
});

const rackWith = (edit) => { const rack = complete(); edit(rack); return rack; };
const check = (rack, schema = SCHEMA(), dry = DRY, nodes = NODES) => validateRack(rack, defs, schema, dry, nodes);

test('the rack file shape is checked before its contents', () => {
  assert.throws(() => check({ shared: [], devices: complete().devices }), /group must be a non-empty string/);
  assert.throws(() => check({ group: 'R', shared: [], devices: [] }), /devices must be a non-empty list/);
  assert.throws(() => check({ group: 'R', devices: complete().devices }), /shared must be a list of stage ids/);
  assert.throws(() => check(rackWith((r) => { r.shared = ['nowhere']; })), /shared names unknown stage nowhere/);
  assert.throws(() => check(rackWith((r) => { r.shared = ['four', 'four']; })), /shared lists stage four twice/);
});

test('a stage is a device or a shared stage, not both', () => {
  assert.throws(() => check(rackWith((r) => { r.shared = ['four', 'one']; })),
    /device one: stage one is in shared; a stage is a device or a shared stage, not both/);
});

test('device ids are camelCase and unique, labels present, no stray fields', () => {
  assert.throws(() => check(rackWith((r) => { r.devices[0].device = 'One'; })), /device One: bad id/);
  assert.throws(() => check(rackWith((r) => { r.devices[1].device = 'one'; })), /device one: duplicate id/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].label = ' '; })), /device one: label required/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].colour = 'red'; })), /device one: unknown field colour/);
});

test('category and requires are derived, so authoring them is an error', () => {
  assert.throws(() => check(rackWith((r) => { r.devices[0].category = 'optic'; })), /device one: category is derived from the stage's site; remove it/);
  assert.throws(() => check(rackWith((r) => { r.devices[1].requires = 'one'; })), /device two: requires is derived from the schema and the dry file; remove it/);
});

test('stage must exist, be unique, and keep schema order', () => {
  assert.throws(() => check(rackWith((r) => { delete r.devices[0].stage; })), /device one: stage required/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].stage = 'ghost'; })), /device one: unknown stage ghost/);
  assert.throws(() => check(rackWith((r) => { r.devices[1].stage = 'one'; })), /device two: stage one already belongs to one/);
  assert.throws(() => check(rackWith((r) => { r.devices.reverse(); })), /device two: out of stage order; stage two precedes stage three in the schema/);
});

test('a device key owned by another stage', () => {
  // Depth's node is owned by stage two; swapping the mixes puts r.depth on
  // device one, and ownership fires while device one is still being read.
  const swapped = rackWith((r) => { r.devices[0].mix = 'Depth'; r.devices[1].mix = 'Blur'; });
  assert.throws(() => check(swapped), /device one: r.depth writes depth, which stage two owns, not stage one/);
});

test('a stage with bound parameters needs a device or a place in shared', () => {
  assert.throws(() => check(rackWith((r) => { r.shared = []; })), /stage four owns gap, written by g.gap, but has no device and is not in shared/);
  // A stage whose parameters prism never binds needs neither.
  const unbound = new Map(NODES);
  unbound.delete('g.gap');
  assert.doesNotThrow(() => check(rackWith((r) => { r.shared = []; }), SCHEMA(), DRY, unbound));
});

test('requires derivation refuses two sources', () => {
  // The schema says three requires two; the dry file says one's entry writes
  // gain, three's mix. Two different devices from two sources is an error.
  const twoSources = SCHEMA();
  twoSources.interactions.push({ kind: 'requires', from: 'three', on: 'two', why: 'x [expose]' });
  const dry = { ...DRY, 'r.bypass.one': entry({ blur: 0, depth: 0, gain: 0 }) };
  assert.throws(() => check(complete(), twoSources, dry, NODES),
    /device three: requires would name one \(dry\) and two \(schema\); one source only until a consumer needs more/);
  // The same device from both sources is one requires.
  const agree = SCHEMA();
  agree.interactions.push({ kind: 'requires', from: 'two', on: 'one', why: 'x [expose]' });
  assert.equal(check(complete(), agree, DRY, NODES).devices[1].requires, 'one');
});

test('rows and keys must exist in the group and belong to exactly one device', () => {
  assert.throws(() => check(rackWith((r) => { r.devices[0].mix = 'Gap'; })), /device one: no matrix row Gap in group R/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].shared = ['r.kind', 'r.kind']; })), /device one: r.kind already belongs to one/);
  // A row claimed twice: device three takes Blur before device one's turn never comes, so
  // the duplicate is reported on the later device.
  assert.throws(() => check(rackWith((r) => { r.devices[2].rows = ['Blur']; })), /device three: row Blur already belongs to one/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].shared = ['r.blur']; })), /device one: no shared parameter r.blur in group R/);
  assert.throws(() => check(rackWith((r) => { r.devices[0].shared = ['g.gap']; })), /device one: no shared parameter g.gap in group R/);
  assert.throws(() => check(rackWith((r) => { r.devices[1].shared = []; })), /r.amount in group R belongs to no device/);
  assert.throws(() => check(rackWith((r) => { r.devices.pop(); })), /row Gain in group R belongs to no device/);
});

test('bypass must be a bool toggle without state', () => {
  assert.throws(() => check(rackWith((r) => { r.devices[0].bypass = 'r.amount'; r.devices[1].shared = ['r.bypass.one']; })), /device one: bypass r.amount must be a bool toggle/);
});

test('a card keeps its head: ui.when may hide a shared key but never the mix row', () => {
  const gate = ', when: {param: r.kind, in: [a], otherwise: hidden}';
  const hiddenShared = defsFrom(DEFS.replace('label: Amount, order: 9}', `label: Amount, order: 9${gate}}`));
  assert.doesNotThrow(() => validateRack(complete(), hiddenShared, SCHEMA(), DRY, NODES));
  const hiddenMix = defsFrom(DEFS
    .replace('order: 2, state: focused, row: Blur}', `order: 2, state: focused, row: Blur${gate}}`)
    .replace('order: 3, state: unfocused, row: Blur}', `order: 3, state: unfocused, row: Blur${gate}}`));
  assert.throws(() => validateRack(complete(), hiddenMix, SCHEMA(), DRY, NODES),
    /device one: mix row Blur cannot be hidden by ui\.when; a card has no head without it/);
});

test('a derived requires names an earlier device', () => {
  // Each device's dry entry zeroes the other's mix: a cycle the panel cannot resolve.
  const mutual = { ...DRY, 'r.bypass.one': entry({ depth: 0 }), 'r.bypass.two': entry({ blur: 0 }) };
  assert.throws(() => check(complete(), SCHEMA(), mutual, NODES),
    /device one: requires two, which comes after it; a device may only require an earlier one/);
  // A forward coupling alone is refused the same way.
  const forward = { ...DRY, 'r.bypass.one': entry({ blur: 0 }), 'r.bypass.two': entry({ blur: 0 }) };
  assert.throws(() => check(complete(), SCHEMA(), forward, NODES),
    /device one: requires two, which comes after it/);
});

test('a manifest node no stage owns fails at load, naming key and node', () => {
  const typo = new Map(NODES);
  typo.set('g.gap', 'gapp');
  assert.throws(() => check(complete(), SCHEMA(), DRY, typo), /g\.gap binds node gapp, which no stage owns/);
});

test('a dry entry names a device bypass', () => {
  assert.throws(() => check(complete(), SCHEMA(), { ...DRY, 'r.bypass.ghost': entry({ gain: 0 }) }, NODES),
    /dry entry r\.bypass\.ghost names no device's bypass/);
});

test('a dry field resolves to its node through the manifest, so an = node derives requires', () => {
  // Device two's amount writes `amount=`, a node no spelling rule reaches
  // from the field name. Device one's entry writing it makes two require one.
  const dry = { ...DRY, 'r.bypass.one': entry({ blur: 0, amount: 0 }) };
  const two = check(complete(), SCHEMA(), dry, NODES).devices[1];
  assert.equal(two.requires, 'one');
  assert.deepEqual(two.interactions.find((i) => i.kind === 'requires'),
    { kind: 'requires', device: 'one', why: 'the r.bypass.one dry entry writes amount=', source: 'dry' });
});

test('the shipped manifest resolves a dry field on an = node', () => {
  const shippedDefs = loadDefs(defsDir());
  const nodes = nodeMap(loadManifests(integrationsDir(), shippedDefs));
  const shipped = loadDry(integrationsDir());
  const distortion = shipped['glass.bypass.distortion'];
  const dry = { ...shipped, 'glass.bypass.distortion': { ...distortion, fields: { ...distortion.fields, noiseType: 'fine' } } };
  const rack = parse(fs.readFileSync(path.join(defsDir(), 'rack', 'devices.yaml'), 'utf8'));
  const noise = validateRack(rack, shippedDefs, loadPipeline(defsDir()), dry, nodes).devices.find((d) => d.device === 'noise');
  assert.equal(noise.requires, 'distortion');
  assert.deepEqual(noise.interactions, [{ kind: 'requires', device: 'distortion', why: 'the glass.bypass.distortion dry entry writes noise type=', source: 'dry' }]);
});

test('a dry field with no manifest node fails naming the entry and its sink', () => {
  const dry = { ...DRY, 'r.bypass.one': entry({ blur: 0, ghost: 0 }) };
  assert.throws(() => check(complete(), SCHEMA(), dry, NODES),
    /dry entry r\.bypass\.one \(sink a\) writes ghost, but no manifest binds r\.ghost to a native node/);
});
