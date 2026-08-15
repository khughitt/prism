import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { withLock } from './lock.js';
import { resolvedPath, sinkStatusPath, statusLockPath } from './paths.js';
import { readJson, writeJsonAtomic } from './store.js';

export function selectSinks(manifests, changedKeys) {
  return manifests.filter((manifest) => manifest.binds.some((bind) => changedKeys.includes(bind.param)));
}

export function boundParams(manifest, resolved) {
  return Object.fromEntries(manifest.binds.map((bind) => [bind.param, resolved.params[bind.param]]));
}

export function runApply(manifest, resolvedFile, keys, timeout = 5_000) {
  execFileSync(path.join(manifest.dir, 'apply'), [resolvedFile, ...keys], { stdio: 'pipe', timeout });
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
    try {
      runner(manifest, resolvedPath(), changedKeys);
      await record(manifest.sink, { ok: true, at, params });
      applied.push(manifest.sink);
    } catch (error) {
      const text = String(error);
      await record(manifest.sink, { ok: false, at, params, error: text });
      failed.push({ sink: manifest.sink, error: text });
    }
  }
  return { applied, failed };
}
