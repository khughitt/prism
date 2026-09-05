---
id: prism-33f4ae
title: "Info buttons: make the description tooltip actually appear on hover"
status: done
priority: 2
size: xs
owner: feat/prism-7e1c66
created: 2026-09-05T21:35:07Z
updated: 2026-09-05T22:00:16Z
depends: []
parent: prism-7e1c66
tags: [noctalia, ui]
---

The circle-i buttons carry a tooltip prop but never react to hover. Noctalia's Button::refreshInputAreaEnabled only enables the InputArea when the button is enabled AND has at least one handler (onClick/onHover/onPress/...); the info button declares neither, so it is inert and the tooltip never opens. Give it a handler and verify the tooltip renders the parameter description.

## Notes

- 2026-09-05T22:00:16Z (feat/prism-7e1c66): Info button carries an inert onClick, which is what enables Noctalia's hit area and lets the description tooltip open
