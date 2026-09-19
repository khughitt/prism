import fs from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { scratchPath } from './paths.js';

// The scratch layer: every edit not yet committed. Runtime state, so it lives
// beside active.json rather than in the dotfiles-tracked config directory.
export function readScratch() {
  let text;
  try {
    text = fs.readFileSync(scratchPath(), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
  const doc = parse(text) ?? {};
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw new Error('scratch must be a flat object');
  }
  return doc;
}

// An empty scratch is no file: a clean store leaves nothing behind.
export function writeScratch(values) {
  const file = scratchPath();
  if (Object.keys(values).length === 0) {
    fs.rmSync(file, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, stringify(values));
  fs.renameSync(tmp, file);
}
