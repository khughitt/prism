---
id: prism-209e6c
title: Adopt the template's setup recipe so a fresh worktree installs node_modules before the suite
status: todo
priority: 2
size: s
complexity: low
process: direct
created: 2026-10-20T12:20:41Z
updated: 2026-10-20T12:20:41Z
depends: []
tags: [dx]
source: ops-9c7dab
agent: claude-code
---

Why: prism's justfile has no `setup` recipe, and a fresh worktree cannot run the suite: src/defs.js:4 and src/contexts.js:4 import `yaml` from node_modules (package-lock.json), and a tree holding only tracked files fails with ERR_MODULE_NOT_FOUND "Cannot find package 'yaml'" (checked 2026-10-20). ops-9c7dab's adopt-when-it-bites rule names prism among the front-door projects that take setup_cmd; a coverage-drop audit follow-up found the report of hand-hydrated adopters behind it (ops-a1e8b1) never got a prism piece.

Done: the justfile gains the ops template's setup_cmd and `setup` recipe (ops templates/justfile: the setup_cmd comment and value at :74-93, the recipe at :133), recorded through tt like the gates. setup_cmd runs `npm ci && attr -s com.dropbox.ignored -V 1 node_modules`, an attribute failure fails setup, and `just work-link` is added only for a directory prism generates that work-link covers. AGENTS.md's Setup names `just setup`.

Verification: in a fresh .worktrees/ checkout, `just setup` then `just test-fast` passes; a second `just setup` succeeds unchanged; node_modules carries the Dropbox ignore attribute (`attr -g com.dropbox.ignored node_modules`).
