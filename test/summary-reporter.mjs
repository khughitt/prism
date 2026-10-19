// The run's totals in the spec reporter's words, and nothing else. It runs beside the
// dot reporter, which draws one character per test and prints each failure in full, so
// a passing run is a few lines instead of one per test. tools/tt reads the test count
// from the `ℹ tests N` line, which the dot reporter alone never prints.
export default async function* summary(source) {
  for await (const event of source) {
    // One summary per file, then one for the whole run, which names no file.
    if (event.type !== 'test:summary' || event.data.file !== undefined) continue;
    const { counts, duration_ms: duration } = event.data;
    let lines = `\nℹ tests ${counts.tests}\nℹ pass ${counts.passed}\nℹ fail ${counts.failed}\n`;
    for (const name of ['cancelled', 'skipped', 'todo']) {
      if (counts[name] > 0) lines += `ℹ ${name} ${counts[name]}\n`;
    }
    yield `${lines}ℹ duration_ms ${duration.toFixed(0)}\n`;
  }
}
