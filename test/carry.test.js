import test from 'node:test';
import assert from 'node:assert/strict';
import { carryScratch } from '../src/carry.js';

test('carryScratch keeps what differs from the new fold and yields the pair its keys', () => {
  const previous = { a: 1, b: 2, c: 3, d: [1, 2] };
  const beneath = { a: 1, b: 5, c: 9, d: [1, 2] };
  assert.deepEqual(carryScratch(previous, beneath, { c: 9 }), { b: 2 },
    'a equals the fold, c belongs to the pair, d is deep-equal');
});

test('carryScratch of an unchanged fold is empty', () => {
  assert.deepEqual(carryScratch({ a: 1 }, { a: 1 }, {}), {});
});

test('carryScratch drops a pending value equal to the pair value', () => {
  assert.deepEqual(carryScratch({ a: 7 }, { a: 7 }, { a: 7 }), {});
});
