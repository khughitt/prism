# Noctalia panel exchange

Type: protocol, data model; document types 1. The CLI model and panel exchange are
currently unversioned; the native plugin descriptor requires Noctalia plugin API
22. This describes participants, model fields, ordering, rendering and failures.
Related: [definitions](definitions.md), [store](store.md), [usage](usage.md) and
[desktop installation](desktop.md#noctalia-plugin-and-hooks).

## Participants and entries

The native v5 host loads `integrations/noctalia-plugin/plugin.toml`:

| Entry | Identity / role |
| --- | --- |
| Plugin | khughitt/prism; descriptor release version 1.0.0, minimum API 22. |
| Widget | `khughitt/prism:widget`, entry `widget.luau`; remembers originating output and opens the attached panel. |
| Panel | `khughitt/prism:panel`, entry `panel.luau`; owns its model/lifecycle and write queue. |
| Backend | `prism` on PATH; no separate preview state or service. |

The panel's production modules are presentation, queue, shell quoting and retained
subtrees. The visible terminal windows show applied results through the niri sink.
The panel and CLI are installed separately and must be upgraded together.

## Describe model

The panel runs `prism describe --json` and validates the complete response before
accepting it. It consumes these top-level fields:

| Field | Meaning |
| --- | --- |
| `active` | `profile` string or null and `wallpaper` `{id, path}` or null; null represents an absent slot. |
| `profiles` | Saved name list from the same locked read as active slots; a broken profile remains discoverable. |
| `layers` | Low-to-high provenance order, including the reserved state position. |
| `rack` | Validated group/shared-stage/device records, with site/scope/family and resolved interactions; [rack model](definitions.md#rack-and-dry-records). |
| `params` | Array of parameter records below. |

Each parameter carries:

| Fields | Meaning |
| --- | --- |
| `key`, `type`, `default`, `description`, `ui` | Definition and UI contract; optional `range`, `values`, `neutral` or `neutralize` follow [definitions](definitions.md#parameter-definitions). Undefined optional JSON fields are omitted. |
| `value`, `layer` | Effective canonical value and its winning layer. |
| `held`, `fallback` | Layers that contain the key (never defaults) and the value a scratch revert would reveal. |
| `bindings` | List of `{sink, liveness}` consumer reports. |
| `effectiveLiveness` | Slowest binding class, or null without consumers. |
| `effectiveDrag` | `live` only when all bindings permit it, otherwise `release`; null when unbound. |
| `effective` | Optional installed `{value, from}` from the sink report, validated by the definition. |

The host decoding assumed by the contract maps JSON null object fields to absent
Lua keys. The harness mirrors that behavior; it does not certify every future
host version. Arrays in the describe shape avoid null holes.

## Ordered exchange and reconciliation

1. On open, clear an old sticky error and start an authoritative describe.
   Accept a valid response only when not invalidated by newer writes or a drag;
   otherwise replay after drag and queue are idle. Keep the last valid model on error.
2. A gesture updates the local visible value and enqueues a shell-quoted command.
   The shared FIFO launches one `noctalia.runAsync` at a time. A pending live sample
   may replace the immediately preceding sample for the same key; ordinary writes
   and the final release write are never discarded that way.
3. Every queue verb can change values or layer ownership and requires reconciliation.
   On queue drain, refresh unless its tail is a live sample; that waits for release.
   Live sliders sample at 100 ms frame intervals and always finish with a non-sample
   write. Reload/restart or release bindings write only on release.
4. Describe decode/validation and rendering happen in separate callbacks. Render
   accepted changes on the next frame tick, not inside refresh. Pointer moves
   schedule at most one render per frame. An identical describe, with no write
   since and no displayed error, is neither decoded nor rebuilt.
5. While open, second ticks trigger a reread every two seconds. Closing stops drag
   frame ticks and performs no backend teardown or automatic commit.

Queue verbs are set, unset, reset, commit, activate, deactivate, clear, rename and
delete; unsupported verbs fail. The [store exchange](store.md#mutation-exchange)
defines destination semantics. Rendered Keep, Save As, Clear, Rename and Delete
capture both expected slots before optimistic changes; stale actions fail under
the store lock. Explicit selection is unguarded and may queue rapid new choices.

An optimistic ordinary selection clears local pending flags. Keep/Clear/Rename/
Delete/Save As stay disabled and handler-guarded until a non-invalidated authoritative
describe is accepted, including after command or refresh failure. Sliders and
rapid selections remain available. Handlers look up current keys, so a slider
queued after selection writes the incoming look. Programmatic model echoes do
not create writes. Broken-look recovery restores preserved scratch on reconciliation.

## Presentation and retention

Title has one visible toggle. Other visible groups are sections ordered by UI
metadata; the rack group contains one card per described device, currently twelve.
Ordinary sections stay open. Focused/unfocused matrix halves are right/left,
with fixed name/value/control spans. Section roles cycle primary/secondary/tertiary.
Rack cards keep their mix row visible, with light/bypass and expandable details;
expansion is shell-session memory. Requires-bypassed cards use the hollow indicator.

Every visible row has its revert/reset affordance even when inactive, dimmed and
handler-guarded for no-op. Per-section/global revert, symmetric and neutral counts
use visible keys; CLI-only terminal-opacity/debug parameters remain outside these
counts. Actual transitions and commits move every scratch key. Unavailable rows
are disabled; row markers prefer unavailable, then wallpaper provenance, then live
drag. Matrix rows combine the two halves' marker precedence.

Source-gated colors show an installed swatch and lock beside the selector; a mix
row keeps its own swatch so the card head does not disappear. Gates affect
presentation, not reset/edit eligibility. Profile and wallpaper headers distinguish
saved adjustments from pending edits. Name input handles Save As/Rename and
replacement confirmation; delete asks before removing a look and all its pairs.

Retain each subtree under a signature of everything its builder reads: describe
entry digest plus changed values, edits, gates, keyboard focus, expansion, bypass
and counts. Builders read no untracked model tables; handlers capture IDs, not
old model objects. Evict only IDs the accepted model drops, never entries merely
unused by a retained parent. The host still reads the whole returned tree.

## Failure and host limits

Launch failure, timeout, nonzero exit, truncated output, invalid JSON or malformed
models remain visible as errors. A command error survives its ensuing successful
refresh; only the next gesture clears it. A panel/CLI mismatch must show the missing
field rather than silently default a different interface. Upgrade both sides when
errors report missing layer/profile/held fields or an obsolete write target.

The panel targets the native host's 25 ms per-callback CPU budget. Repeated overruns
can disable the plugin until reload. Retention and callback separation protect that
budget; offline Lua-call ceilings are regression guards, not live CPU guarantees.
Host versions must preserve the modeled decode, event and runtime-lifetime behavior.
API 22 lacks slider interaction-source metadata: an exact 5%-range keyboard/wheel
delta is mapped to one canonical step, but an identical pointer delta is ambiguous.
Its native dropdown also lacks a Lua-exposed same-option reselect capability;
use Keep for wallpaper or the CLI. Neither gap is repaired by invented callbacks.

`integrations/noctalia-plugin/contract.test.mjs` drives the real CLI into the actual
Lua model validator/rendering code. The full suite also runs direct Lua module
checks. Those checks establish model/queue/render agreement, not fresh physical
desktop acceptance, multi-version host behavior or a permission to reload a shell.
