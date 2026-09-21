import { readRuntime, writeRuntime } from './contexts.js';

export function readScratch() {
  return readRuntime().scratch;
}

export function writeScratch(scratch) {
  writeRuntime({ ...readRuntime(), scratch });
}
