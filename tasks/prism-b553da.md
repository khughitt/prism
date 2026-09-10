---
id: prism-b553da
title: Profile selector snaps back to the old profile until the activate round trip completes
status: done
priority: 1
size: s
owner: profile-selector
created: 2026-09-10T16:24:16Z
updated: 2026-09-10T16:26:14Z
depends: []
tags: [noctalia, ui, profiles]
---

Reported 2026-09-10: after picking another profile the selector keeps showing the previous name. Root cause: Noctalia's select re-applies selectedIndex on every render (options is always sent, which resets its change memory), and the panel's render right after onChange still declares state.model.active.profile, which only changes once the activate lands, niri reloads, and describe returns. Sliders are optimistic through updateParam; the selector is not. Fix: set the local active profile on pick before rendering, and let describe reconcile on success or failure.

## Notes

- 2026-09-10T16:26:14Z (profile-selector): Selector pick is optimistic: active.profile is set locally before the render that follows the pick; describe reconciles on success or failure
