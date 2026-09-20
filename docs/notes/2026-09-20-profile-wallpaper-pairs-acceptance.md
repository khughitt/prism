# Look–wallpaper pair acceptance

Status: prepared, desktop results **unobserved**. Existing task `prism-439774`
consumes this note; no second acceptance task is needed. The controller owns
live migration, the migration report, plugin installation/reload, and the user
acceptance session. Keep the branch unmerged until that task records results.

## Automated preflight

Run from the implementation checkout. The suite creates temporary stores and
isolates integrations; it does not migrate the live store or reload the plugin.

```sh
just test
just check
tasks check
```

Record date/commit, exit codes, test count, and all task warnings here:

- Date / commit: __________
- `just test`: __________
- `just check`: __________
- `tasks check` (zero errors; list warnings): __________

Automated failure injection supplies interruption evidence at durable write
boundaries. Do **not** corrupt real desktop files to simulate crashes. Tests
cover malformed incoming pairs refusing before writes, recovery from broken
outgoing profiles/pairs with scratch, retry before the runtime write, and
`prism apply` after completed recovery when the bus needs repair. Repeating
selection after recovery completed is a new ordinary selection, not a recovery
retry. These are process-interruption guarantees, not power-loss durability.

## Desktop observations

For each item record the actual result, date, and screenshots or command output
where useful. Empty spaces mean unobserved, never an implicit pass.

1. **Zero-count selection while open.** Start with empty scratch. Switch between
   two profiles differing on many sliders. Check zero pending edits immediately,
   after reconciliation, after repeated renders, and after periodic refresh.
   Sliders stay available; Keep/Clear/Rename/Delete/Save As stay disabled until
   accepted reconciliation. Observe two rapid selections and a genuine slider
   move queued behind selection: the move belongs to the incoming look.
   Result / evidence: __________
2. **Aurora/W versus Dark/W.** From Aurora/W with zero scratch, edit two visible
   sliders. Observe `2 edits`. Select Dark: optimistic zero, authoritative zero,
   Dark's own values and pair count. Return to Aurora: both values return,
   zero pending edits, `2 for Aurora + this wallpaper`. Repeat refresh while
   open; no fabricated edits. CLI-only saved keys do not increase that count.
   Result / evidence: __________
3. **Independent rotation.** Tune Aurora/W and Dark/W differently, rotate away
   and back under each look, and verify each pair restores its own values.
   With no scratch, compare selection-then-rotation with rotation-then-selection.
   The panel must not issue wallpaper-observation commands.
   Result / evidence: __________
4. **Keep and Clear locality.** Keep in look has no visible jump and changes no
   other pair. Keep for wallpaper saves only the current pair. Clear removes
   only that pair, preserving scratch and other pairs. If an external selection
   or rotation makes an old panel action stale, both captured slots must reject
   the action and reconcile its error/count.
   Result / evidence: __________
5. **Neutral and Revert.** Capture the look file bytes. Neutral, then Revert,
   restores profile-plus-pair appearance without changing those bytes. Revert
   also removes ordinary pending edits and restores the saved pair.
   Result / evidence: __________
6. **Rename, recovery, and migration evidence.** Rename a look and verify its
   pairs follow it without an appearance change. Record temporary-store
   malformed-input/interruption/recovery test results from the preflight;
   do not damage live files. Record the actual migration command, report,
   and backup evidence below when the controller performs live acceptance.
   Result / evidence: __________

Additional cases:

- **Save As replacement:** replace an existing destination profile; its current
  pair must not override the snapshot, another destination pair must survive,
  and the screen must not jump. Result / evidence: __________
- **Default:** index 0 selects the unnamed look; its pair is independent of
  Aurora/Dark and a named profile called Default. Verify
  `2 for Default + this wallpaper`. Result / evidence: __________
- **No wallpaper:** no wallpaper header, Keep for wallpaper unavailable;
  explicit selection discards pending edits. Result / evidence: __________
- **First wallpaper / deletion:** first wallpaper activation preserves scratch;
  deleting the active profile selects Default and preserves scratch.
  Result / evidence: __________
- **CLI same-look selection:** with visible and CLI-only scratch, explicitly
  activate the current look; all keys save to its pair and pending edits clear.
  With no wallpaper, all scratch is discarded. Result / evidence: __________

Native limitation: the installed Noctalia select suppresses same-option user
click callbacks; programmatic selection updates are silent. Lua cannot enable
its unexposed `notifyOnReselect` property. A simulated callback is not desktop
proof of a physical same-option click. Existing Keep for wallpaper already
saves the current pair; idea `prism-02befb` tracks exposing the native property.
No new control or native change belongs to this acceptance implementation.

## Live migration record (controller / prism-439774)

- Date / operator / code revision: __________
- Command (normally `prism migrate pairs`): __________
- Complete migration report (attach or link): __________
- First complete immutable backup location: __________
- Later modifying-attempt backup locations, if any: __________
- Original files and `originally-absent.txt` inspected: __________
- Reported copied/matching pairs and scratch move: __________
- Completed rerun is a no-op and creates no backup: __________
- Installed CLI/plugin revisions and reload observation: __________
- User acceptance / remaining issues: __________

Preserve the first complete backup. Later attempt backups describe later
prefixes and do not replace it. Manual rollback copies config-relative files
back to config and `state/` files back to state, then removes the outputs listed
in `originally-absent.txt`. This is an explicit restoration to the old layout;
ordinary reads never use old global pairs as a fallback.
