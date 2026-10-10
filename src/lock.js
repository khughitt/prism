import { unlink, readFile, writeFile, link, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isAlive as defaultIsAlive, startTimeOf } from './proc.js';

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mintToken = () => `${process.pid}:${startTimeOf(process.pid)}:${randomUUID()}`;

function parseToken(text) {
  const [pidText, startText] = String(text).trim().split(':');
  const pid = Number.parseInt(pidText ?? '', 10);
  if (!Number.isInteger(pid)) return null;
  const starttime = Number.parseInt(startText ?? '', 10);
  return { pid, starttime: Number.isInteger(starttime) ? starttime : null };
}

// Only proven death frees a holder. Age never does: a clock that jumps while every
// process is frozen (an IO stall, a suspend) makes a live holder look old, and
// preempting it lets two processes hold the lock at once.
function isStaleText(text, isAlive) {
  const holder = parseToken(text);
  if (holder === null) return true;
  return !isAlive(holder.pid, { starttime: holder.starttime });
}

async function readHolder(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// The file appears complete or not at all, so its holder is never unknown.
async function plant(path, token) {
  const temp = `${path}.tmp.${process.pid}.${randomUUID()}`;
  await writeFile(temp, token);
  try {
    await link(temp, path);
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return false;
  } finally {
    await unlink(temp).catch(() => {});
  }
}

// Removes `path` only while it still holds the dead holder judged here. Removal by
// path alone would delete a replacement planted between the verdict and the unlink,
// so the file is moved aside, checked, and put back if it was not the dead one.
// Returns whether `path` is now free.
async function clearIfDead(path, isAlive) {
  const text = await readHolder(path);
  if (text === null) return true;
  if (!isStaleText(text, isAlive)) return false;
  const tomb = `${path}.dead.${process.pid}.${randomUUID()}`;
  try {
    await rename(path, tomb);
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    throw error;
  }
  try {
    if (await readFile(tomb, 'utf8') === text) return true;
    try {
      await link(tomb, path);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      throw new Error(`lock ${path}: moved aside a live holder and could not restore it`);
    }
    return false;
  } finally {
    await unlink(tomb);
  }
}

async function reclaim(lockPath, isAlive) {
  const guard = `${lockPath}.reclaim`;
  if (!(await plant(guard, mintToken()))) {
    await clearIfDead(guard, isAlive);
    return false;
  }
  try {
    return await clearIfDead(lockPath, isAlive);
  } finally {
    await unlink(guard);
  }
}

export async function withLock(lockPath, fn, opts = {}) {
  const {
    retries = 600,
    delayMs = 20,
    isAlive = defaultIsAlive,
    sleep = defaultSleep,
  } = opts;

  await mkdir(dirname(lockPath), { recursive: true });
  const token = mintToken();
  let acquired = false;
  for (let attempt = 0; attempt <= retries && !acquired; attempt++) {
    acquired = await plant(lockPath, token);
    if (acquired) break;
    const free = await reclaim(lockPath, isAlive);
    if (!free) await sleep(delayMs);
  }

  if (!acquired) {
    const holder = parseToken(await readHolder(lockPath) ?? '');
    const by = holder === null ? '' : ` (held by pid ${holder.pid})`;
    throw new Error(`could not acquire lock: ${lockPath}${by}`);
  }
  try {
    return await fn();
  } finally {
    try {
      const current = await readFile(lockPath, 'utf8');
      if (current.trim() === token) await unlink(lockPath);
    } catch {
      // Already gone or owned by someone else. Cleanup must never throw.
    }
  }
}
