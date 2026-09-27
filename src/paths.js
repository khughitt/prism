import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function configDir() {
  return process.env.PRISM_CONFIG_DIR
    ?? path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'prism');
}

export function stateDir() {
  return process.env.PRISM_STATE_DIR
    ?? path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), '.local', 'state'), 'prism');
}

export const valuesPath = () => path.join(configDir(), 'values.yaml');
export const resolvedPath = () => path.join(stateDir(), 'resolved.json');
export const sinkStatusPath = () => path.join(stateDir(), 'sink-status.json');
export const statusLockPath = () => path.join(stateDir(), 'status.lock');
// One lock per sink: two hooks firing together (a rotation's fan-out and the
// palette's colors_changed apply) must not interleave one sink's render.
export const sinkLockPath = (sink) => path.join(stateDir(), 'sinks', `${sink}.lock`);
export const lockPath = () => path.join(stateDir(), 'store.lock');
export const activePath = () => path.join(stateDir(), 'active.json');
// Retired standalone scratch; only the explicit layout migration reads it.
export const scratchPath = () => path.join(stateDir(), 'scratch.yaml');
export const contextsDir = () => path.join(configDir(), 'contexts');
export const generatedPath = (name) => path.join(stateDir(), 'generated', name);
export const defsDir = () => fileURLToPath(new URL('../defs/', import.meta.url));
export const integrationsDir = () =>
  process.env.PRISM_INTEGRATIONS_DIR ?? fileURLToPath(new URL('../integrations/', import.meta.url));
