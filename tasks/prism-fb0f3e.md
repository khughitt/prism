---
id: prism-fb0f3e
title: Compare glass grain with GIMP CIE LCh and HSV noise
status: done
priority: 2
size: s
owner: glass-noise-acceptance
created: 2026-09-07T21:16:08Z
updated: 2026-09-07T21:28:48Z
depends: []
tags: [noise, research]
---

Compare native white/fine/Oklab-lightness grain against the current GEGL CIE LCh and HSV implementations. Record channel/distribution/spatial differences, realtime shader feasibility, and grain-size control requirements. Deliver a source-backed note; do not implement new native filters yet.

## Notes

- 2026-09-07T21:28:38Z (glass-noise-acceptance): Compared pinned GEGL CIE LCh/HSV source with native shader; documented Dulling distribution, channel differences, realtime feasibility, and independent grain-size requirements. No new native filters implemented.
- 2026-09-07T21:28:48Z (glass-noise-acceptance): Report: docs/notes/2026-09-07-glass-noise-gimp-comparison.md; inspected GEGL ccdec52d4d98ae79106a5cbe032cff9a83467116 and native noise implementation 098bcdca.
