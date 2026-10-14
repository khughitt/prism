---
id: prism-a67714
title: Find whether a niri background-effect surface softens the wallpaper between windows without touching the glass
status: todo
priority: 2
size: s
complexity: mid
process: direct
created: 2026-10-14T11:10:59Z
updated: 2026-10-14T11:10:59Z
depends: []
parent: prism-85caf6
tags: [wallpaper, niri]
source: docs/notes/2026-10-14-wallpaper-softening-brief.md
agent: claude-code
---

Question: Does a fully transparent Bottom-layer layer-shell surface, matched by a niri layer-rule with background-effect { blur true; saturation <s>; noise <n> } (xray default), soften the wallpaper visible between windows while the glass keeps refracting the unprocessed Background layer, and what does it cost per frame?
Where to start: niri-material docs/wiki/Window-Effects.md (xray blur is computed once and reused) and Configuration:-Layer-Rules.md (background-effect, since 26.04; the running niri is 26.04); integrations/debug-backdrop/shell.qml and docs/superpowers/specs/2026-08-29-prism-debug-backdrop-design.md (a qs layer surface owned by a prism sink; xray buffers fill from Layer::Background only); integrations/niri/render.js for where a layer-rule would be rendered.
Bound: One throwaway qs surface plus one layer-rule, judged at two or three blur/saturation/noise settings with stills of a gap and of a glass window before and after; a brightness/contrast stand-in only as a translucent fill on the same surface. Run in a nested niri where possible; the live desktop only with the owner's go-ahead at that moment. No prism parameters, sink, or panel work.
Expected result: Record whether the gaps soften, whether the glass is unchanged, the frame cost, how a translucent fill covers brightness/contrast, and a recommendation among this surface, wali pre-processing, and a Noctalia wallpaper contribution, on this task and in docs/notes/2026-10-14-wallpaper-softening-brief.md.
Ideas it wakes: On completion, run `tasks note prism-d46d07 --no-reviewed "<finding>"` before this result's branch merges.
