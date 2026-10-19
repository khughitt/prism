// What the dot reporter beside it leaves out, and nothing else. The dot reporter draws
// one character per test and lists each failed test with its error, so a passing run
// is a few lines instead of one per test. It drops three things this one prints:
// - what test files write to stdout and stderr, which is the only cause shown for a
//   file that fails to load (a syntax error, a missing import, a top-level throw);
// - each skipped test with its reason, so a check that stopped running stays visible;
// - the run's totals in the spec reporter's words: tools/tt reads the test count from
//   the `ℹ tests N` line.
// Lives outside test/ so node's default file glob never runs it as a test file.
export default async function* summary(source) {
  for await (const event of source) {
    const { type, data } = event;
    if (type === 'test:stdout' || type === 'test:stderr') {
      yield data.message;
    } else if (type === 'test:pass' && data.skip !== undefined) {
      const reason = typeof data.skip === 'string' ? ` # ${data.skip}` : '';
      yield `\n﹣ ${data.name}${reason} (${data.file ?? 'unknown file'})\n`;
    } else if (type === 'test:summary' && data.file === undefined) {
      // One summary per file, then one for the whole run, which names no file.
      const { counts, duration_ms: duration } = data;
      let lines = `\nℹ tests ${counts.tests}\nℹ pass ${counts.passed}\nℹ fail ${counts.failed}\n`;
      for (const name of ['cancelled', 'skipped', 'todo']) {
        if (counts[name] > 0) lines += `ℹ ${name} ${counts[name]}\n`;
      }
      yield `${lines}ℹ duration_ms ${duration.toFixed(0)}\n`;
    }
  }
}
