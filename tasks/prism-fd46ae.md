---
id: prism-fd46ae
title: "Colour agent replies per harness: project colours on task ids and a highlighted lead line"
status: idea
priority: 2
created: 2026-10-22T01:23:12Z
updated: 2026-10-24T16:11:02Z
depends: [lore-587c8a]
tags: []
source: "user:2026-10-21 lore session"
agent: claude-code/claude-opus-5-5
---

User ask (2026-10-21): colour task ids in agent replies by their project's colour and highlight a tl;dr or key element so a reply can be understood at a glance.

Findings are attached to lore-587c8a (reply-color-findings.md). The model cannot set RGB on reply text itself, so each harness needs a display-side renderer reading the project colour from the source ops-30b965 settled (tasks' color key, exposed as JSON on tasks projects rows):
- pi: pi.registerMarkdownTransformer, display only; about ten lines.
- Claude Code: a mod on the AssistantMessage render site (documented; whether Text takes hex is unverified).
- opencode: no inline hook; a TUI plugin registerCodeBlockRenderer for a dedicated fenced block only.
- codex: no inline hook; a Stop hook's systemMessage renders ANSI below the reply (it receives last_assistant_message).
Each also needs a theme check so the highlight reads on dark and light. The writing convention the renderers key on (bare canonical ids, one lead line) is lore-587c8a. First step when scoped: run the headless pi and Claude Code probes in that file before choosing harnesses.

## Notes

- 2026-10-24T16:11:02Z (main): lore-587c8a is done and its reviewed convention landed on main at 80acfc7 (fast-forward activation e3bfd05), with user approval: write task ids bare as <prefix>-<6 hex>, outside backticks and links; an id inside a command shown as code stays there. No fixed lead marker: match the opening paragraph by position. Generated instructions and provenance refreshed; just check passed. Renderer implementation remains this task.
