import test from 'node:test';
import assert from 'node:assert/strict';
import { newQueue, enqueue, finish, argvFor } from '../integrations/noctalia-plugin/queue.mjs';

const sample = (key, value) => ({ verb: 'set', key, value, sample: true });
const release = (key, value) => ({ verb: 'set', key, value, sample: false });
const unset = (key) => ({ verb: 'unset', key });

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

test('argvFor: samples and releases produce the same command line', () => {
  assert.deepEqual(argvFor(sample('a.x', 0.5)), ['prism', 'set', 'a.x', '0.5']);
  assert.deepEqual(argvFor(release('a.x', 0.5)), ['prism', 'set', 'a.x', '0.5']);
  assert.deepEqual(argvFor(unset('a.x')), ['prism', 'unset', 'a.x']);
});
