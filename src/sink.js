import fs from 'node:fs';
import path from 'node:path';

// Every child prism spawns runs under this bound, apply and probes alike.
export const SINK_TIMEOUT = 5_000;

// A probe's own children get a tighter bound. A probe killed by SINK_TIMEOUT
// dies on SIGKILL, which no finally block survives: it would leave both the
// command it was waiting on and the temp config it wrote. Bounding its
// children instead lets the probe return, report, and clean up.
export const PROBE_CHILD_TIMEOUT = 2_000;

const text = (value) => (Buffer.isBuffer(value) ? value.toString('utf8') : value ?? '').trim();

// A child's own words, never Node's inspection of the error object. An
// execFileSync failure carries the child's output as Buffers, and printing the
// error renders them as Buffer(2383) [Uint8Array] [69, 114, ...] — which then
// becomes the parent's stderr, and its parent's, until doctor prints it.
// Multi-line output is passed through as written: a validator's report names
// the rejected property in its body.
export function diagnose(error) {
  const stderr = text(error?.stderr);
  if (stderr) return stderr;
  const stdout = text(error?.stdout);
  if (stdout) return stdout;
  if (error?.code === 'ENOENT' && String(error.syscall).startsWith('spawn') && error.path) {
    return `${error.path} is not installed`;
  }
  return text(error?.message) || String(error);
}

// An apply script's top-level guard: a throw at any depth leaves as the
// diagnostic itself, and the exit code still fails the sink.
export function sinkMain(fn) {
  try {
    fn();
  } catch (error) {
    process.stderr.write(`${diagnose(error)}\n`);
    process.exit(1);
  }
}

export function onPath(command) {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  return dirs.some((dir) => {
    const candidate = path.join(dir, command);
    try {
      if (!fs.statSync(candidate).isFile()) return false;
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}
