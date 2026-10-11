# Matched panel-budget probe readiness

Scratch calibration only. No live timing verdict, install, desktop action, real CLI
execution by the fake host, shared pointer change, or store write occurred.

`build.py`, `probe.lua`, and `tail.lua` must stay together. `copies/` contains the
five-cold/no-launch calibration copies; `sequence-copies/` contains one-cold plus
five launch/control trials per variant. Each contains unchanged frozen `source/`,
a scratch `plugin/`, source identity, reversible transform manifest, and diff.
The parser preserves every raw event and exclusion; only callback totals feed the
six-class acceptance gate. Render/native/helper/observer totals remain separate.

Inputs and command example (from the task worktree):

```sh
SCRIPTS=/path/to/extracted/readiness
SCRATCH=/path/to/new/scratch
CLI="$PWD/bin/prism"
MODEL_JSON=/path/to/readonly-describe.json
BASELINE=9bf4e8e920c005f8a4d1666b32b4e1a516856ac2
CANDIDATE=e7384b0d7ab3e8e935cdf0776043839441132af5
python3 "$SCRIPTS/build.py" --baseline "$BASELINE" --candidate "$CANDIDATE" \
  --cli "$CLI" --output "$SCRATCH" --nonce fresh-activation \
  --block 1 --cold-pairs 1 --launch-pairs 1
```

Use a fresh builder nonce for each planned runtime activation. The output nonce is
suffixed by variant. Disable/enable must load the corresponding fresh copy; close/open
keeps state and does not satisfy activation freshness. Never merge unrelated activation
logs into one block/variant. Keep all six original modules and the saved source hashes.
The copies themselves remain in scratch; the controller owns any host-use permission.

The saved real fixture has 83 parameters, 12 cards and 23 profiles. `model.lua` is its
portable Lua literal. `test_encode.lua` is the existing test encoder, reused by the fake
host for signature and deep-tree checks. To convert another supplied fixture:

```sh
python3 - "$SCRIPTS/build.py" "$MODEL_JSON" "$SCRATCH/model.lua" <<'PY'
import importlib.util, json, sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('builder',sys.argv[1])
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
Path(sys.argv[3]).write_text('return '+builder.lua(json.loads(Path(sys.argv[2]).read_text()))+'\n')
PY
```

To repeat the saved cold/timeline/classification check, build with `--cold-pairs 5
--launch-pairs 0`; pass copy root, model, existing encoder, and explicit worktree CLI:

```sh
lua "$SCRIPTS/self-check.lua" "$SCRATCH" "$SCRATCH/model.lua" \
  "$SCRIPTS/test_encode.lua" "$CLI"
python3 "$SCRIPTS/analysis_check.py"
noctalia plugins lint "$SCRATCH/baseline/plugin"
noctalia plugins lint "$SCRATCH/candidate/plugin"
luac -p "$SCRATCH/baseline/plugin/panel.luau"
luac -p "$SCRATCH/candidate/plugin/panel.luau"
```

The sequence mode needs `--cold-pairs 1 --launch-pairs 5` and a final `sequence`
argument to `self-check.lua`. It writes fake logs in each variant directory.

Readiness button: expand every card and settle all real work, then click **Sample
diagnostics**. The click hides its construction and does not render. The finite sequence
uses a separate frame setup/decode callback followed by a frame render. Setup clears
both memo and shown stdout before replaying the exact saved stdout, so acceptance
actually replaces model/structure. The first measured tree has no diagnostics control.
It then alternates launch/control trials, reversing order between variants. Every pair
starts only after the previous frame and diagnostic command complete. Real queue and
release/correction paths remain unchanged.

Each launch calls the existing private helper, which constructs a copied argv and
explicit worktree command before timing only `noctalia.runAsync`. Immediate render
follows `run` in that same frame callback; another frame callback renders once before
ordinary tick work. Completion records flags without decoding stdout. A dirty input, foreign launch or describe result during an active pair, expansion/focus/value change,
failed launch/completion, malformed completion, or overlap invalidates the pair.

Target timing ends before its record is buffered. Identity expansion, JSON encoding and
logging run in a separate otherwise-idle frame flush callback, in chunks of at most sixteen records. Active drags (including nondirty sampling ticks), ordinary deferred renders and due diagnostic setup/render work always run first. An input collision invalidates its pair and performs normal frame work exactly once. `observerFlush` records that cost,
which never enters target samples. Luau `os.clock` is elapsed time, an upper bound;
it is not measured thread CPU or GC time. Fake Lua durations are calibration only.

Parser example, requiring the observed host budget-error count explicitly:

```sh
python3 "$SCRIPTS/analyze.py" --log /path/to/first-segment --offset SAVED_BYTE_OFFSET \
  --log /path/to/next-segment --identity "$SCRATCH/baseline/identity.json" \
  --identity "$SCRATCH/candidate/identity.json" --budget-errors OBSERVED_COUNT \
  --output /path/to/verdict.json
python3 "$SCRIPTS/analyze.py" --pilot /path/to/measured-pilot.json
```

Logs contain `prism-budget ` JSON. Chunked observer records can appear before previously buffered target records in transport order; creation record ids preserve monotonic clock order, which the parser verifies. Retain the first activation and final drain records.
Callback id zero, incomplete spans, interference and readiness callbacks with the transient control visible have explicit exclusions. A pair
requires native/helper/completion evidence, real immediate/frame renders in separate
callbacks, and a valid disposition. Immediate-minus-frame uses their actual record ids;
controls stay separate. Five launch pairs split across pending/done states cannot form
a primary aggregate. Primary launch groups additionally need five valid controls.

`analyze.py` is the single reusable estimator. Its input has setup/restore/analysis
seconds, four ordered B1/C1/C2/B2 activation entries with reloadExpand/coldPair/
releaseRestore/profileRoundTrip seconds, and launchPair/controlPair seconds lists.
Missing/nonfinite/negative inputs fail. Probe intervals include command-completion
waits and carry a clock origin. Subtract timestamps only within that origin. The
controller supplies administration and user-action timestamps and distinguishes
hands-on time from desktop occupancy. `pilot-fixture.json` yields 9 minutes solely as
a boundary self-check; it is not a prediction for the live session.

Periodic correction: harmless odd updates do not interfere. Original even updates and
refreshes still run normally. The finite sequence waits for temporary busy state through
the original command completion/10s timeout, resumes after unchanged results between
trials, and stops on accepted changed inputs or errors. A foreign launch/describe during
a pair invalidates that pair with raw reasons, but unchanged settlement permits the
remaining finite trials. Invalid trials stay excluded; no automatic extra retries are
invented, and fewer than five valid pairs still make the launch result inconclusive.
To run the regular-tick end-to-end fixture, use the one-cold/five-launch copies and
pass `periodic` as the last self-check argument. It saves clean and interference logs.
