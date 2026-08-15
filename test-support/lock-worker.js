import { readFile, writeFile } from 'node:fs/promises';
import { withLock } from '../src/lock.js';

const [, , lockPath, counterPath, iterationsArg, retriesArg, delayMsArg] = process.argv;
const iterations = Number.parseInt(iterationsArg, 10);
const retries = Number.parseInt(retriesArg, 10);
const delayMs = Number.parseInt(delayMsArg, 10);

async function readCounter() {
  try {
    return Number.parseInt(await readFile(counterPath, 'utf8'), 10);
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

async function run() {
  for (let i = 0; i < iterations; i += 1) {
    await withLock(lockPath, async () => {
      const current = await readCounter();
      await new Promise((resolve) => setTimeout(resolve, 5));
      await writeFile(counterPath, String(current + 1));
    }, { retries, delayMs });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
