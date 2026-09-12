---
id: prism-71be98
title: "prism requirements: evaluate declared sink requirements alone"
status: done
priority: 2
size: s
created: 2026-09-12T10:42:54Z
updated: 2026-09-12T10:44:40Z
completed: 2026-09-12T10:44:40Z
depends: []
tags: [cli, requirements]
---

prism doctor evaluates each sink's declared requirements, but only after generated-file, orphan-value, and context checks, and it exits 1 on those first. dotfiles' setup preflight runs before setup has linked ~/.config/prism or applied any sink, so it needs the requirements on their own: one line per unmet requirement in doctor's wording (<sink>: <problem> — <fix>), exit 1 if any, 'requirements: ok' and exit 0 otherwise. Resolved params come from loadStore, which treats a missing store as empty and falls back to defaults, so 'when' evaluates on a fresh machine. dots-f3f92e consumes it.

## Notes

- 2026-09-12T10:44:40Z (requirements): prism requirements prints each unmet declared requirement in doctor's wording and exits 1, 'requirements: ok' otherwise; a missing store resolves to defaults so it runs before setup has linked anything
