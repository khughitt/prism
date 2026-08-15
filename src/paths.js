import os from 'node:os';
import path from 'node:path';

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
export const lockPath = () => path.join(stateDir(), 'store.lock');
export const generatedPath = (name) => path.join(stateDir(), 'generated', name);
export const defsDir = () => new URL('../defs/', import.meta.url).pathname;
export const integrationsDir = () =>
  process.env.PRISM_INTEGRATIONS_DIR ?? new URL('../integrations/', import.meta.url).pathname;
