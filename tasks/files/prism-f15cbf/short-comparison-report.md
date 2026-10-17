# Short in-host comparison, 2026-10-17

Baseline `bec7219` (retained render, no tokens) against candidate `5f08fec` (compact
metadata tokens), alternated B1, C1, B2, C2, each a fresh panel runtime (hot reload,
distinct nonce). Every rack card expanded. Per activation: 10 cold renders (retained
memo cleared, one per frame tick, started automatically 3 s after open) and 3 owner
slider releases. Spans are `os.clock()` around each host callback, logged through
`noctalia.log`; wallpaper rotation paused, scratch state restored byte-exact after.

Host budget errors during the session: 0.

## Pooled (ms)

| Callback | B n | B median | B max | C n | C median | C max |
|---|---|---|---|---|---|---|
| coldRender | 20 | 15.953 | 24.132 | 20 | 17.082 | 22.181 |
| dragEnd | 6 | 18.149 | 18.555 | 6 | 17.419 | 18.341 |
| async:set | 6 | 16.495 | 18.789 | 6 | 15.534 | 18.354 |
| async:describe | 20 | 2.837 | 11.22 | 15 | 5.912 | 10.192 |
| frameTick | 352 | 7.746 | 24.164 | 311 | 7.614 | 22.214 |

## Raw spans (ms)

- B1 coldRender: 21.442, 18.382, 15.82, 11.271, 18.005, 19.75, 17.638, 16.086, 10.886, 18.802
- B1 dragEnd: 16.274, 18.083, 18.555
- B1 async:set: 16.673, 16.632, 18.789
- C1 coldRender: 22.181, 18.198, 14.81, 20.96, 17.983, 15.805, 10.77, 10.617, 19.408, 19.846
- C1 dragEnd: 17.366, 16.15, 18.341
- C1 async:set: 14.922, 16.145, 18.354
- B2 coldRender: 24.132, 20.429, 14.174, 13.028, 10.902, 11.489, 11.928, 20.873, 11.379, 12.068
- B2 dragEnd: 18.553, 18.216, 17.639
- B2 async:set: 13.467, 16.357, 16.155
- C2 coldRender: 20.695, 18.269, 16.181, 12.015, 10.764, 18.837, 19.943, 15.308, 10.929, 11.585
- C2 dragEnd: 17.472, 17.73, 16.125
- C2 async:set: 13.492, 16.546, 12.706

## Reading

- Tokens do not lower cold render: both variants are bimodal (about 11 ms and 18-21 ms)
  and overlap completely; B median 15.95, C 17.08. The token change is reverted.
- Releases (17-18.6 ms), write completions (12.7-18.8 ms) and drag frames (median 7.7 ms)
  sit clear of the 25 ms budget.
- The first full cold render after expanding every card is the worst case in every
  activation (20.7, 21.4, 22.2, 24.1 ms): under budget, without clear headroom.
