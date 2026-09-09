import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const integration = fileURLToPath(new URL('../integrations/debug-backdrop/', import.meta.url));
const applySource = path.join(integration, 'apply');
const shellSource = path.join(integration, 'shell.qml');
const diagnostic = (result) => result.stderr || String(result.error || '');

function fixture(t, { shell = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-debug-backdrop-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const targetIntegration = path.join(dir, 'integrations', 'debug-backdrop');
  const bin = path.join(dir, 'bin');
  const log = path.join(dir, 'qs.log');
  const resolved = path.join(dir, 'resolved.json');
  fs.mkdirSync(targetIntegration, { recursive: true });
  fs.mkdirSync(bin);
  // apply imports ../../src/sink.js, so the copy needs the same depth below a
  // src it can reach — the real one, so the test cannot drift from it.
  fs.symlinkSync(fileURLToPath(new URL('../src/', import.meta.url)), path.join(dir, 'src'), 'dir');

  const apply = path.join(targetIntegration, 'apply');
  const shellPath = path.join(targetIntegration, 'shell.qml');
  if (fs.existsSync(applySource)) {
    fs.copyFileSync(applySource, apply);
    fs.chmodSync(apply, 0o755);
  }
  if (shell) fs.copyFileSync(shellSource, shellPath);

  fs.writeFileSync(path.join(bin, 'qs'), `#!/bin/sh
printf '%s\n' "$*" >> "$QS_FAKE_LOG"
if [ "$1" = list ]; then
  printf '%s' "$QS_FAKE_LIST_STDOUT"
  printf '%s' "$QS_FAKE_LIST_STDERR" >&2
  exit "${'${QS_FAKE_LIST_STATUS:-0}'}"
fi
printf '%s' "$QS_FAKE_ACTION_STDOUT"
printf '%s' "$QS_FAKE_ACTION_STDERR" >&2
exit "${'${QS_FAKE_ACTION_STATUS:-0}'}"
`, { mode: 0o755 });

  const calls = () => (fs.existsSync(log)
    ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
    : []);
  const empty = `No running instances for "${shellPath}"\nUse --all to list all instances.\n`;
  const present = JSON.stringify([{ config_path: shellPath }]);
  // apply runs under `#!/usr/bin/env node`, so a PATH that hides qs must still
  // find node — and node's own directory is usually the one qs lives in.
  const nodeOnly = path.join(dir, 'node-only');
  fs.mkdirSync(nodeOnly);
  fs.symlinkSync(process.execPath, path.join(nodeOnly, 'node'));

  const run = ({
    value,
    qs = true,
    actionStatus = 0,
    actionStdout = '',
    actionStderr = '',
    listStatus = 0,
    listStdout = value ? present : empty,
    listStderr = '',
  }) => {
    fs.writeFileSync(resolved, JSON.stringify({ params: { 'debug.backdrop': value } }));
    return spawnSync(apply, [resolved], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: qs ? `${bin}:${process.env.PATH}` : nodeOnly,
        QS_FAKE_LOG: log,
        QS_FAKE_ACTION_STATUS: String(actionStatus),
        QS_FAKE_ACTION_STDOUT: actionStdout,
        QS_FAKE_ACTION_STDERR: actionStderr,
        QS_FAKE_LIST_STATUS: String(listStatus),
        QS_FAKE_LIST_STDOUT: listStdout,
        QS_FAKE_LIST_STDERR: listStderr,
      },
    });
  };

  return { run, calls, shellPath, empty, present };
}

test('start succeeds only after the selected config is listed', (t) => {
  const { run, calls, shellPath, empty } = fixture(t);

  const started = run({ value: true });
  assert.equal(started.status, 0, diagnostic(started));
  assert.deepEqual(calls(), [
    `-d -n -p ${shellPath}`,
    `list -p ${shellPath} --json`,
  ]);

  const silentFailure = run({
    value: true,
    listStdout: empty,
    actionStderr: 'Failed to load configuration',
  });
  assert.notEqual(silentFailure.status, 0);
  assert.match(diagnostic(silentFailure), /Failed to load configuration/);
});

test('start rejects a nonzero launcher exit even when an instance is listed', (t) => {
  const { run, present } = fixture(t);

  const result = run({
    value: true,
    actionStatus: 1,
    actionStderr: 'quickshell unavailable',
    listStdout: present,
  });

  assert.notEqual(result.status, 0);
  assert.match(diagnostic(result), /quickshell unavailable/);
});

test('stop accepts 0 or 255 only when the selected config is absent', (t) => {
  const { run, calls, shellPath, empty, present } = fixture(t);

  for (const actionStatus of [0, 255]) {
    const result = run({ value: false, actionStatus, listStdout: empty });
    assert.equal(result.status, 0, diagnostic(result));
  }
  assert.deepEqual(calls().slice(0, 2), [
    `kill -p ${shellPath}`,
    `list -p ${shellPath} --json`,
  ]);

  const stillRunning = run({ value: false, actionStatus: 255, listStdout: present });
  assert.notEqual(stillRunning.status, 0);
  assert.match(diagnostic(stillRunning), /still running/);
});

test('stop rejects exit codes other than 0 and 255', (t) => {
  const { run } = fixture(t);

  const result = run({ value: false, actionStatus: 1, actionStderr: 'kill failed' });

  assert.notEqual(result.status, 0);
  assert.match(diagnostic(result), /kill failed/);
});

test('listing failures and unknown output stay loud', (t) => {
  const { run } = fixture(t);

  const failed = run({ value: false, listStatus: 1, listStdout: 'list failed' });
  assert.notEqual(failed.status, 0);
  assert.match(diagnostic(failed), /list failed/);

  const malformed = run({ value: false, listStdout: 'Nothing to see here\n' });
  assert.notEqual(malformed.status, 0);
  assert.match(diagnostic(malformed), /unexpected qs list output/);
});

test('a missing shell fails before qs is invoked', (t) => {
  const { run, calls } = fixture(t, { shell: false });

  const result = run({ value: false });

  assert.notEqual(result.status, 0);
  assert.equal(calls().length, 0);
  assert.match(diagnostic(result), /shell\.qml/);
});
