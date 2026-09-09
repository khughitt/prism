import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { withLock } from './lock.js';
import { resolvedPath, sinkStatusPath, statusLockPath } from './paths.js';
import { diagnose, onPath, SINK_TIMEOUT } from './sink.js';
import { readJson, writeJsonAtomic } from './store.js';

export { SINK_TIMEOUT };

export function selectSinks(manifests, changedKeys) {
  return manifests.filter((manifest) => manifest.binds.some((bind) => changedKeys.includes(bind.param)));
}

export function boundParams(manifest, resolved) {
  return Object.fromEntries(manifest.binds.map((bind) => [bind.param, resolved.params[bind.param]]));
}

export function runApply(manifest, resolvedFile, keys, timeout = SINK_TIMEOUT) {
  execFileSync(path.join(manifest.dir, 'apply'), [resolvedFile, ...keys], {
    stdio: 'pipe', timeout, killSignal: 'SIGKILL',
  });
}

// A probe is a child like any other and gets the bound apply already has: an
// unbounded one would hang the fan-out, every sink behind it, and doctor. A
// probe killed at the bound has not established that the requirement is met,
// so silence counts as unmet rather than as satisfaction.
function probeProblem(file, name, timeout) {
  try {
    execFileSync(file, [], { stdio: 'pipe', timeout, killSignal: 'SIGKILL' });
    return null;
  } catch (error) {
    // execFileSync reports a timeout as code ETIMEDOUT with signal SIGKILL and
    // no `killed` property at all — verified against Node 20 before this was
    // written, because the obvious `error.killed` is silently always undefined.
    if (error?.code === 'ETIMEDOUT') return `probe ${name} did not finish within ${timeout / 1000}s`;
    return diagnose(error);
  }
}

// A requirement whose `when` param is false is not checked: the sink still
// runs, it simply does not need the thing. The probe or prism states the
// problem, the manifest states the fix.
export function unmetRequirement(manifest, resolved, { timeout = SINK_TIMEOUT } = {}) {
  for (const requirement of manifest.requires ?? []) {
    if (requirement.when !== undefined && resolved.params[requirement.when] !== true) continue;
    const problem = requirement.command !== undefined
      ? (onPath(requirement.command) ? null : `${requirement.command} is not installed`)
      : probeProblem(path.join(manifest.dir, `probe-${requirement.probe}`), requirement.probe, timeout);
    if (problem) return `${problem} — ${requirement.fix}`;
  }
  return null;
}

async function record(sink, entry) {
  await withLock(statusLockPath(), async () => {
    const status = readJson(sinkStatusPath(), {});
    status[sink] = entry;
    writeJsonAtomic(sinkStatusPath(), status);
  });
}

export async function fanOut({ manifests, resolved, changedKeys, runner = runApply }) {
  const applied = [];
  const failed = [];
  for (const manifest of selectSinks(manifests, changedKeys)) {
    const at = new Date().toISOString();
    const params = boundParams(manifest, resolved);
    const unmet = unmetRequirement(manifest, resolved);
    if (unmet) {
      await record(manifest.sink, { ok: false, at, params, error: unmet });
      failed.push({ sink: manifest.sink, error: unmet });
      continue;
    }
    try {
      runner(manifest, resolvedPath(), changedKeys);
      await record(manifest.sink, { ok: true, at, params });
      applied.push(manifest.sink);
    } catch (error) {
      const text = diagnose(error);
      await record(manifest.sink, { ok: false, at, params, error: text });
      failed.push({ sink: manifest.sink, error: text });
    }
  }
  return { applied, failed };
}
