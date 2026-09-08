# Declared sink requirements and legible sink failures

**Date:** 2026-09-08
**Status:** design approved 2026-09-08; not yet implemented.
Covers `prism-2983d1` (legible apply failures), `prism-bba7ec`
(debug-backdrop declares quickshell), and `prism-d836de` (the niri sink
declares its niri-material requirement). Related: `material-09d8c0`, the
same contract seen from the packaging side.

## Context

Bringing europa up to date on 2026-09-08, after roughly three weeks, hit
three failures in the sink layer. Each was legible in principle and
illegible in practice.

**The Buffer dumps.** `integrations/niri/apply` rethrows the `execFileSync`
error from a rejected `niri validate` with a bare `throw`. Node's
uncaught-exception printer inspects the whole error object, so the child's
`stdout` and `stderr` land in the output as
`Buffer(2383) [Uint8Array] [69, 114, ...]`. That inspection *is* the apply
script's stderr, so `runApply` wraps it into its own error message,
`fanOut` records the result verbatim as `entry.error` (`src/fanout.js:40`),
and `prism doctor` prints it (`src/cli.js:284`). One raw throw floods four
layers, and `dotfiles-health` prints the result again. The underlying
diagnostic — niri naming the property it rejected — was readable the whole
time and was simply buried.

**The undeclared quickshell dependency.** `integrations/debug-backdrop/apply`
spawns `qs` before reading `debug.backdrop`, so a machine without
quickshell fails the sink whether or not the backdrop was ever wanted. On
europa quickshell was ABI-broken; an uninstalled `qs` fails identically. The
dependency is real and nothing declares it: `qs` comes from `extra/quickshell`,
not from Noctalia.

**The undeclared niri-material requirement.** `integrations/niri/render.js`
emits the `material` definitions unconditionally — `glass.enabled` only
controls whether a window rule *assigns* one. Stock niri 26.04 does not know
the `material` node, so it answered with a screenful of KDL parse errors that
named a syntax position and never the cause. `glass.enabled=false` is
therefore no escape hatch: the sink also owns `compositor.gaps`,
`terminal.apps` and the window rules, none of which need glass, and none of
which a stock-niri machine can have.

The common shape: a sink knows what it needs, knows it before it runs, and
has nowhere to say so. The dotfiles `setup_preflight` phase added in
`dc34651` names two of these prerequisites, but only because it hardcodes
them — it restates knowledge that belongs to the sink.

## Decision

A sink declares its prerequisites in its manifest. Prism checks them before
running the sink and reports an unmet one with a single line naming the fix.
Separately, no sink failure is ever reported by inspecting a Node error
object.

### 1. `requires` in the manifest

`manifest.yaml` grows an optional `requires` list. Each entry carries
exactly one of two forms:

```yaml
requires:
  - command: qs
    when: debug.backdrop
    fix: "install quickshell (extra/quickshell)"
```

```yaml
requires:
  - probe: material
    when: glass.enabled
    fix: "install niri-material"
```

| Key | Meaning |
| --- | --- |
| `command` | satisfied when the named command is found on `PATH` |
| `probe` | satisfied when `<sink dir>/probe-<name>` exits 0 |
| `when` | optional; the requirement is checked only when this `bool` param is true |
| `fix` | required; what the operator should do about it |

`loadManifests` validates the list the way it already validates `binds`:
exactly one of `command` and `probe`, `fix` a non-empty string, `probe`
naming an executable file in the sink's directory, and `when` naming a
param that `defs` defines with `type: bool`. An invalid `requires` is a
manifest error, not a runtime surprise.

A probe is an executable beside `apply`, not a probe kind prism knows about.
Composition: prism runs a file and reads an exit code, and the sink owns
what the check means. A probe takes no arguments — `when` is evaluated by
prism, before the probe runs.

A probe is a child process and gets the same bound `apply` already has:
`runApply` runs a sink under a five-second `timeout` with
`killSignal: 'SIGKILL'` (`src/fanout.js:15`), and a probe added ahead of it
would otherwise run unbounded, hanging the fan-out and every later sink with
it — and `doctor`, which runs the same probes. Probes share that constant.
A probe killed at the bound is an unmet requirement like any other, reported
as such:

```
prism: niri: probe material did not finish within 5s — install niri-material
```

That is a deliberate reading. A probe that cannot answer in five seconds has
not established that the requirement is met, and treating the silence as
satisfaction would let the sink run into the failure the probe exists to
prevent.

### 2. Checking, and what a failure says

`fanOut` evaluates a selected sink's requirements before spawning its
`apply`. A requirement whose `when` param is false is not checked, and the
sink runs anyway; `when` unset or true means the requirement is checked. A
checked, unmet requirement fails the sink and skips `apply`.

An unmet requirement is recorded as `ok: false` with the message as
`entry.error`, exactly like any other sink failure. No new status state:
`prism doctor` (`src/cli.js:284`) and `dotfiles-health` already surface that
field, and they should not have to learn a second one.

The two forms differ in who states the problem. For `command`, prism states
it. For `probe`, the probe's stderr states it — so the probe owns what is
actually installed, and the manifest owns what to do:

```
prism: debug-backdrop: qs is not installed — install quickshell (extra/quickshell)
prism: niri: this niri does not accept the material node (installed: niri 26.04 (f0370f52)) — install niri-material
```

`prism doctor` also reports unmet requirements directly, evaluating each
`when` against current resolved params, so a machine learns what it is
missing without first provoking a failed apply.

### 3. The diagnostic, never an object

New `src/sink.js`, two exports:

- `diagnose(error)` returns the child's stderr text when the error carries
  one — Buffer-decoded and trimmed — falling back to a named message for
  `ENOENT` (which names the command that was not found), then to
  `error.message`, and last to `String(error)` so the result is never empty.
  It never returns an inspected object.
- `sinkMain(fn)` runs `fn`, and on a throw writes `diagnose(error)` to
  stderr and exits 1.

All three apply scripts wrap their body in `sinkMain`, so a throw at any
depth reaches stderr as the diagnostic itself and the Buffer dumps have no
path there.

`diagnose` preserves the diagnostic as the child wrote it, newlines
included. It is not a one-line contract, and must not become one: niri
rejects a config with a multi-line miette report whose body carries the
property name and its position, which is the only part an operator can act
on. Trimming the ends is the whole normalisation. The one-line contract
belongs to the messages prism composes itself — the unmet-requirement lines
in section 2 — where prism controls every character.

The distinction is the entire lesson of the europa failure: what flooded
`doctor` was never the length of niri's diagnostic but an inspected error
object printed in its place.

`fanOut` uses `diagnose` in place of `String(error)` (`src/fanout.js:40`).
That also drops the
`Error: Command failed: /…/integrations/niri/apply /…/resolved.json glass.roughness …`
prefix from every recorded status, which is prism restating its own
invocation to an operator who did not type it.

### 4. The three sinks

**niri.** A new `integrations/niri/probe-material` writes a minimal config
to a temp file and runs `niri validate -c` on it:

```kdl
material "prism-probe" {
    glass {
        ior 1.5
    }
}
```

Verified on titan 2026-09-08: exit 0 under niri-material, and exit 1 for a
config containing a node niri does not know. On failure the probe writes one
line naming the missing capability and the output of `niri --version`, which
is the only identity an installed niri offers — `niri --version` prints
`niri 26.04 (f0370f52)`, upstream's version with a build commit, so there is
no niri-material version number to compare a minimum against. The probe
states a capability, not a version.

`render.js` stops emitting the `material` definitions when `glass.enabled`
is false. With the requirement's `when: glass.enabled` the two agree: glass
off means no `material` node is written and none is required, so the sink
applies gaps, terminal window rules and the inert background effect on a
stock niri. Everything left in that fragment is upstream vocabulary:
`background-effect` arrives with `931123f3`, "Implement ext-background-effect
protocol", which is Ivan Molodetskikh's and an ancestor of `upstream/main`,
while the `material` node is niri-material's own (`3040120e`). The escape
hatch parses on a stock niri because nothing niri-material added is left in
it. `apply` loses its bare `throw` to `sinkMain`.

The probe covers a niri that does not know the `material` node at all. It
does not cover a niri-material build too old for a property prism has since
added — the `type=` on `noise` that europa's packaged builds predated. That
case belongs to `material-09d8c0` on the packaging side; here it stays a
composed-validate failure, which is now legible because of section 3.

**debug-backdrop.** Declares `command: qs` with `when: debug.backdrop`. When
`debug.backdrop` is false and `qs` is absent, `apply` exits 0: no instance of
this shell can be running if quickshell was never installed, so there is
nothing to stop. That is the clean skip — stated explicitly, with the reason
in a comment, not inferred from a swallowed error.

**kitty.** Adopts `sinkMain`, and nothing else. It declares no requirement:
`kitten` ships with kitty, so a machine that can run a kitty terminal can run
the sink. Its no-sockets behaviour is deliberately loud and stays that way —
`applyToKittySockets` throws `no kitty remote-control sockets found …`
(`integrations/kitty/live.js:38`) and `test/kitty-sink.test.js:57` requires
that failure. `sinkMain` changes how that error is printed, never whether it
is raised.

## Testing

| Test | Fact |
| --- | --- |
| `sink.test.js` | `diagnose` on a Buffer-bearing error, an `ENOENT`, and a plain `Error` |
| `sink.test.js` | a multi-line stderr survives `diagnose` intact, body and all |
| `manifest.test.js` | each `requires` validation failure: both forms, neither form, missing `fix`, missing probe file, `when` naming an unknown param, `when` naming a non-`bool` param |
| `fanout.test.js` | unmet with `when` true fails the sink with the fix line and never spawns `apply`; unmet with `when` false runs the sink |
| `fanout.test.js` | a recorded failure carries the child's diagnostic, multi-line body included, without the `Command failed:` prefix |
| `fanout.test.js` | a probe that never exits is killed at the bound, fails only its own sink, and a later selected sink still applies |
| `niri-render.test.js` | `glass.enabled: false` emits no `material` block |
| `niri-apply.test.js` | existing diagnostic assertions, plus `doesNotMatch(/Buffer\(|Uint8Array/)` |
| `niri-apply.test.js` | `probe-material` against a fake niri that rejects the node: one line naming niri-material |
| `debug-backdrop-sink.test.js` | `debug.backdrop: false` with `qs` absent exits 0 |
| `cli.test.js` | `doctor` reports an unmet requirement, and stays silent when `when` is false |

## Out of scope

The dotfiles `setup_preflight` phase keeps its hardcoded quickshell and
niri-accepts-the-config checks for now. Replacing them with a call that reads
prism's declaration is filed as its own task in `dots`, because preflight
runs before `npm ci` may ever have run on that machine and the call has to sit
behind the `node_modules` check already above it.
