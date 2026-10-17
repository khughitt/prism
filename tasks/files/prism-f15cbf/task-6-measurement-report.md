# Panel render-budget measurement

The full dataset is incomplete: the controller closed the measured window and
restored the original plugin before the user confirmed/completed the profile
phase, so no switch callback samples were captured. This was premature controller
closure, not user refusal or stopping. Cold-render and drag-release requirements
were individually missed with sufficient samples. Acceptance was not applied;
return to design before recording offline ceilings.

Run `1791659395` lasted 988 seconds (16 minutes 28 seconds). Every rack card was
expanded for the acknowledged cold/drag exercise. Figures are Luau `os.clock()`
elapsed milliseconds, an upper bound on host thread CPU. The host's CPU meter is
authoritative; the measured new-code probe run added **zero CPU-budget error lines**.
The controller found **two post-restoration CPU-budget errors**, at 15:29:50 and
15:30:15, on the original main plugin. These are outside the measured probe run
and are not attributed to the measured code.

| Callback class | Median target (ms) | Median (ms) | Maximum (ms) | Samples | Observation |
| --- | ---: | ---: | ---: | ---: | --- |
| Expanded cold render | <15 | 21.39 | 23.65 | 5 | Requirement missed |
| Active drag render | ≤12 | 8.33 | 12.10 | 333 | Median within target |
| Drag release | ≤12 | 19.26 | 20.77 | 7 | Requirement missed |
| Changed describe | ≤12 | 10.00 | 11.52 | 14 | Median within target |
| Deferred describe render | ≤12 | 8.54 | 10.45 | 13 | Median within target |
| Profile-switch describe | ≤12 | — | — | 0 | Missing |
| Profile-switch render | <15 | — | — | 0 | Missing |

Idle callbacks at or below 0.5 ms are excluded. Changed-describe and deferred
render samples come from after the first release and before the switch-phase
boundary, excluding initial-load and cold-press descriptions. This classification
does not prove every description was triggered by a release. Zero switch samples
means the whole-run gate is incomplete despite sufficient cold/release samples.

Above-target samples were cold render 22.22, 23.65, 21.39, 17.64 ms; active drag
12.10 ms; and release 19.63, 19.06, 18.60, 17.57, 19.26, 19.42, 20.77 ms.
All causes remain unknown; no scheduling-noise or root-cause claim is established.

The controller's final restoration checks found all **21 profile documents
byte-equal to the full snapshot**, the original active profile restored, and exact
original scratch/runtime restored while preserving the latest independent
wallpaper. Late profile switches after probe restoration had committed the saved
scratch into the current wallpaper pair; the controller verified that precise
change and restored the original document bytes from full backups under the store
lock. Source-only wallpaper metadata and current independent wallpaper changes
were preserved. Whole describe output differs in active and derived metadata;
canonical values and saved profile documents were checked separately. The original
plugin pointer was restored, restoration applied, and the original plugin reloaded
again. The controller's final host-load check found nothing running.

Evidence files: `full-1791659395-results.json`, `full-1791659395.log`, and
`full-state.json`. Cold/drag/release sample lists match the saved probe log; all
reported counts, medians, and maxima were recalculated from saved values.

Revise design part 5 using cold median **21.39 ms (n=5)** and release median
**19.26 ms (n=7)**, preserving their maxima and the missing-switch limitation.
Stop and return to design per the spec; review that revision before further
implementation or offline ceilings. No new
algorithm is proposed. Future acceptance still requires at least five usable
samples per required class, including profile-switch describe and render.

No code, host, or task changes were made while preparing this report. No
background work remains from report preparation.
