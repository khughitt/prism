import { open, unlink, readFile, writeFile, link, stat, mkdir } from 'node:fs/promises';
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

function isStaleText(text, mtimeMs, staleMs, now, isAlive) {
  const holder = parseToken(text);
  if (holder === null) return true;
  if (!isAlive(holder.pid, { starttime: holder.starttime })) return true;
  return now() - mtimeMs > staleMs;
}

async function acquire(lockPath, token) {
  const temp = `${lockPath}.tmp.${process.pid}.${randomUUID()}`;
  await writeFile(temp, token);
  try {
    await link(temp, lockPath);
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return false;
  } finally {
    await unlink(temp).catch(() => {});
  }
}

const GUARD_STALE_MS = 5_000;
const DEFAULT_RETRIES = 600;
const DEFAULT_DELAY_MS = 20;

if (DEFAULT_RETRIES * DEFAULT_DELAY_MS <= GUARD_STALE_MS) {
  throw new Error(
    `lock.js: default acquisition budget (${DEFAULT_RETRIES * DEFAULT_DELAY_MS}ms) ` +
    `must exceed GUARD_STALE_MS (${GUARD_STALE_MS}ms), or a default-options caller ` +
    'can never outlast a crashed guard-holder'
  );
}

async function reclaim(lockPath, staleMs, now, isAlive) {
  const guard = `${lockPath}.reclaim`;
  let handle;
  try {
    handle = await open(guard, 'wx');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const info = await stat(guard).catch(() => null);
    if (info && now() - info.mtimeMs > GUARD_STALE_MS) await unlink(guard).catch(() => {});
    return false;
  }

  try {
    const info = await stat(lockPath).catch(() => null);
    if (info === null) return true;
    const text = await readFile(lockPath, 'utf8').catch(() => null);
    if (text === null) return true;
    if (!isStaleText(text, info.mtimeMs, staleMs, now, isAlive)) return false;
    await unlink(lockPath).catch(() => {});
    return true;
  } finally {
    await handle.close();
    await unlink(guard).catch(() => {});
  }
}

export async function withLock(lockPath, fn, opts = {}) {
  const {
    retries = DEFAULT_RETRIES,
    delayMs = DEFAULT_DELAY_MS,
    staleMs = 10_000,
    now = () => Date.now(),
    isAlive = defaultIsAlive,
    sleep = defaultSleep,
  } = opts;

  await mkdir(dirname(lockPath), { recursive: true });
  const token = mintToken();
  let acquired = false;
  for (let attempt = 0; attempt <= retries && !acquired; attempt++) {
    acquired = await acquire(lockPath, token);
    if (acquired) break;
    const free = await reclaim(lockPath, staleMs, now, isAlive);
    if (!free) await sleep(delayMs);
  }

  if (!acquired) throw new Error(`could not acquire lock: ${lockPath}`);
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
