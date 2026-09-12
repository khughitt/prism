---
id: prism-859bb7
title: prism writes runtime contexts under the tracked per-host config dir
status: idea
priority: 2
created: 2026-09-12T10:23:31Z
updated: 2026-09-12T10:23:31Z
depends: []
tags: [dotfiles]
---

prism context <name> creates prism/<host>/contexts/<name>/ inside the dotfiles tree (setup.sh ensure_dirs contexts/ there and $XDG_CONFIG_HOME/prism links to it). Those are runtime values, not configuration: dotfiles-health's leak check flags every one as unowned and Dropbox carries them to the other machine. Route contexts to XDG_STATE_HOME/prism and read them from there; dotfiles then drops the ensure_dir and its 'real directory' health check.
