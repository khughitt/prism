import test from 'node:test';
import assert from 'node:assert/strict';
import * as Queue from '../integrations/noctalia-plugin/queue.mjs';

const { newQueue, enqueue, finish, argvFor } = Queue;

const sample = (key, value) => ({ verb: 'set', key, value, sample: true });
const release = (key, value) => ({ verb: 'set', key, value, sample: false });
const unset = (key) => ({ verb: 'unset', key });
const previewShow = (output, side, diagnosticBackground) => ({
  verb: 'preview-show', output, side, diagnosticBackground,
});
const previewHide = () => ({ verb: 'preview-hide' });

function drain(state) {
  const ran = [];
  for (;;) {
    const result = finish(state);
    state = result.state;
    if (result.drained) return ran;
    ran.push(result.launch);
  }
}

test('idle enqueue launches immediately with empty pending', () => {
  const { state, launch } = enqueue(newQueue(), sample('a.x', 1));
  assert.deepEqual(launch, sample('a.x', 1));
  assert.deepEqual(state.pending, []);
});

test('successive same-key drag samples coalesce to the newest', () => {
  let { state } = enqueue(newQueue(), sample('a.x', 1));
  ({ state } = enqueue(state, sample('a.x', 2)));
  ({ state } = enqueue(state, sample('a.x', 3)));
  assert.deepEqual(drain(state), [sample('a.x', 3)], 'stale sample 2 must never run');
});

test('discrete writes are FIFO and never dropped: three rapid unsets all run', () => {
  let { state } = enqueue(newQueue(), unset('a.x'));
  ({ state } = enqueue(state, unset('b.y')));
  ({ state } = enqueue(state, unset('c.z')));
  assert.deepEqual(drain(state), [unset('b.y'), unset('c.z')]);
});

test('cross-key samples do not coalesce with each other or with discrete items', () => {
  let { state } = enqueue(newQueue(), sample('a.x', 1));
  ({ state } = enqueue(state, sample('a.x', 2)));
  ({ state } = enqueue(state, { verb: 'set', key: 'b.y', value: true, sample: false }));
  ({ state } = enqueue(state, sample('a.x', 3)));
  assert.deepEqual(drain(state), [
    sample('a.x', 2),
    { verb: 'set', key: 'b.y', value: true, sample: false },
    sample('a.x', 3),
  ]);
});

test('release ordering: the plain set runs last even after fast drag samples', () => {
  let { state } = enqueue(newQueue(), sample('a.x', 0.1));
  ({ state } = enqueue(state, sample('a.x', 0.2)));
  ({ state } = enqueue(state, release('a.x', 0.2)));
  const ran = drain(state);
  assert.equal(ran[ran.length - 1].sample, false, 'release write must be the last launched');
});

test('release, preview hide, and a later sample retain FIFO order', () => {
  let { state, launch } = enqueue(newQueue(), release('a.x', 1));
  ({ state } = enqueue(state, previewHide()));
  ({ state } = enqueue(state, sample('a.x', 2)));
  assert.deepEqual([launch].concat(drain(state)), [
    release('a.x', 1),
    previewHide(),
    sample('a.x', 2),
  ]);
});

test('argvFor: samples and releases produce the same command line', () => {
  assert.deepEqual(argvFor(sample('a.x', 0.5)), ['prism', 'set', 'a.x', '0.5']);
  assert.deepEqual(argvFor(release('a.x', 0.5)), ['prism', 'set', 'a.x', '0.5']);
  assert.deepEqual(argvFor(unset('a.x')), ['prism', 'unset', 'a.x']);
});

test('preview verbs have explicit path-free Quickshell argv', () => {
  assert.deepEqual(argvFor(previewShow('DP-1', 'right', true)), [
    'qs', '-c', 'niri-glass', 'ipc', 'call', 'prismGlass',
    'showPreview', 'DP-1', 'right', 'true',
  ]);
  assert.deepEqual(argvFor(previewHide()), [
    'qs', '-c', 'niri-glass', 'ipc', 'call', 'prismGlass', 'hidePreview',
  ]);
});

test('only set and unset items affect persistent parameter state', () => {
  assert.equal(Queue.affectsParams(sample('a.x', 1)), true);
  assert.equal(Queue.affectsParams(release('a.x', 1)), true);
  assert.equal(Queue.affectsParams(unset('a.x')), true);
  assert.equal(Queue.affectsParams(previewShow('DP-1', 'right', false)), false);
  assert.equal(Queue.affectsParams(previewHide()), false);
});

test('drain refresh requires a parameter write and a non-sample tail', () => {
  assert.equal(Queue.shouldRefresh(false, previewHide()), false);
  assert.equal(Queue.shouldRefresh(true, release('a.x', 1)), true);
  assert.equal(Queue.shouldRefresh(true, previewHide()), true);
  assert.equal(Queue.shouldRefresh(true, sample('a.x', 1)), false);
});

test('a final write followed by a new drag sample defers refresh', () => {
  assert.equal(Queue.shouldRefresh(true, { verb: 'set', key: 'a.x', value: 2, sample: true }), false);
});

test('only drag samples defer a refresh when their queue drains', () => {
  assert.equal(Queue.isSample?.(sample('a.x', 0.5)), true);
  assert.equal(Queue.isSample?.(release('a.x', 0.5)), false);
  assert.equal(Queue.isSample?.(unset('a.x')), false);
});
