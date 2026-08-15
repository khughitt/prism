import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStat, ancestors, isAlive, startTimeOf } from '../src/proc.js';

const statLine = (over = {}) => {
  const f = {
    pid: 4242, comm: 'claude', state: 'S', ppid: 4200, pgrp: 4242, session: 4242,
    ttyNr: 34816, tpgid: 4242, flags: 4194304, minflt: 100, cminflt: 0, majflt: 0,
    cmajflt: 0, utime: 1, stime: 2, cutime: 3, cstime: 4, priority: 20, nice: 0,
    numThreads: 1, itrealvalue: 0, starttime: 987654, ...over,
  };
  return [f.pid, `(${f.comm})`, f.state, f.ppid, f.pgrp, f.session, f.ttyNr, f.tpgid,
    f.flags, f.minflt, f.cminflt, f.majflt, f.cmajflt, f.utime, f.stime, f.cutime,
    f.cstime, f.priority, f.nice, f.numThreads, f.itrealvalue, f.starttime].join(' ');
};

test('parses a comm containing spaces and parentheses', () => {
  assert.deepEqual(parseStat(statLine({ comm: 'my (weird) proc' })), {
    pid: 4242, comm: 'my (weird) proc', ppid: 4200, ttyNr: 34816, starttime: 987654,
  });
});

test('parses starttime — field 22, the thing that makes a pid an identity', () => {
  assert.equal(parseStat(statLine({ starttime: 1234567 })).starttime, 1234567);
  assert.equal(parseStat('500 (node) S 400 0 0 0 0').starttime, null);
});

test('returns null on garbage rather than a half-built record', () => {
  assert.equal(parseStat(''), null);
  assert.equal(parseStat('nonsense'), null);
});

test('walks the ancestor chain, self first, and stops at pid 1', () => {
  const table = {
    500: '500 (node) S 400 0 0 0 0 0 0 0 0 0 0 0 0 0',
    400: '400 (zsh) S 300 0 0 0 0 0 0 0 0 0 0 0 0 0',
    300: '300 (claude) S 1 0 0 0 0 0 0 0 0 0 0 0 0 0',
  };
  assert.deepEqual(ancestors(500, { readStat: (pid) => table[pid] ?? null }).map((p) => p.comm), ['node', 'zsh', 'claude']);
});

test('a vanished ancestor truncates the chain rather than throwing', () => {
  const readStat = (pid) => pid === 500 ? '500 (node) S 999 0 0 0 0 0 0 0 0 0 0 0 0 0' : null;
  assert.deepEqual(ancestors(500, { readStat }).map((p) => p.pid), [500]);
});

test('isAlive is true for THIS process — with its real starttime, read from real /proc', () => {
  const mine = startTimeOf(process.pid);
  assert.ok(Number.isInteger(mine));
  assert.equal(isAlive(process.pid, { starttime: mine }), true);
});

test('isAlive is false for an impossible pid', () => {
  assert.equal(isAlive(0x7fffffff, { starttime: 123 }), false);
});

test('a RECYCLED pid is a different process, and is NOT alive — kill(pid, 0) cannot see this', () => {
  const mine = startTimeOf(process.pid);
  assert.equal(isAlive(process.pid, { starttime: mine + 1 }), false);
  assert.equal(isAlive(1, { starttime: 999_999_999 }), false);
});

test('a record with NO starttime is unverifiable, and unverifiable is treated as dead', () => {
  assert.equal(isAlive(process.pid), false);
  assert.equal(isAlive(process.pid, { starttime: null }), false);
});

test('a pid recycled into ANOTHER USER\'S process is caught too — EPERM is not proof of identity', () => {
  const readStat = () => '1 (systemd) S 0 1 1 0 -1 4194560 100 0 0 0 1 2 3 4 20 0 1 0 5';
  assert.equal(isAlive(1, { starttime: 999, readStat }), false);
  assert.equal(isAlive(1, { starttime: 5, readStat }), true);
});
