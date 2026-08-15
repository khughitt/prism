import { readFileSync } from 'node:fs';

const FIELD = (n) => n - 3;

export function parseStat(text) {
  if (!text) return null;
  const open = text.indexOf('(');
  const close = text.lastIndexOf(')');
  if (open < 0 || close < 0 || close < open) return null;

  const pid = Number.parseInt(text.slice(0, open).trim(), 10);
  const comm = text.slice(open + 1, close);
  const after = text.slice(close + 1).trim().split(/\s+/);
  const ppid = Number.parseInt(after[FIELD(4)], 10);
  const ttyNr = Number.parseInt(after[FIELD(7)], 10);
  if (![pid, ppid, ttyNr].every(Number.isInteger)) return null;

  const raw = Number.parseInt(after[FIELD(22)], 10);
  const starttime = Number.isInteger(raw) ? raw : null;
  return { pid, comm, ppid, ttyNr, starttime };
}

const defaultReadStat = (pid) => {
  try { return readFileSync(`/proc/${pid}/stat`, 'utf8'); }
  catch { return null; }
};

export function ancestors(pid, { readStat = defaultReadStat } = {}) {
  const chain = [];
  const seen = new Set();
  let current = pid;
  while (current > 1 && !seen.has(current)) {
    seen.add(current);
    const stat = parseStat(readStat(current));
    if (!stat) break;
    chain.push(stat);
    current = stat.ppid;
  }
  return chain;
}

export function startTimeOf(pid, { readStat = defaultReadStat } = {}) {
  return parseStat(readStat(pid))?.starttime ?? null;
}

export function pidExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

export function isAlive(pid, { starttime = null, readStat = defaultReadStat } = {}) {
  if (!pidExists(pid)) return false;
  if (!Number.isInteger(starttime)) return false;
  return startTimeOf(pid, { readStat }) === starttime;
}
