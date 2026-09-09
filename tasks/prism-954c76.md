---
id: prism-954c76
title: Confirm how Noctalia's json.decode renders JSON null
status: done
priority: 2
size: xs
owner: main
created: 2026-09-09T01:55:10Z
updated: 2026-09-09T23:41:28Z
depends: []
tags: [noctalia, integration, testing]
---

integrations/noctalia-plugin/contract.test.mjs renders real describe output as a Lua literal on the assumption that the host's json.decode maps a JSON null to an absent key -- 'describe' emits null for an inactive wallpaper or profile slot, and for every def field a parameter does not carry. The panel leans on that mapping: validateModel reads 'param.value == nil' as 'has no value', and Presentation.profileSection reads 'model.active.profile' as nil for 'no profile loaded'. If Noctalia's decoder instead yields a sentinel (a userdata, a table, or the string 'null'), those checks pass where they should fail and the profile selector shows a loaded profile that is not there -- and the contract test would not catch it, because the test supplies the mapping it assumes. Read the decoder in the installed Noctalia, or decode a null through it in a scratch panel, and record the answer in docs/notes/noctalia-plugin-contract.md. If it is not nil, the test's serializer and the panel's nil checks both need the real sentinel.

## Notes

- 2026-09-09T23:40:50Z (main): Confirmed at installed v5.0.1 (luau_host.cpp jsonToLua): JSON null decodes to Lua nil; object nulls become absent keys via lua_setfield, matching the panel nil checks and the test serializer. No code change needed; recorded in docs/notes/noctalia-plugin-contract.md.
- 2026-09-09T23:41:28Z (main): Confirmed against installed Noctalia v5.0.1 source (jsonToLua in luau_host.cpp): JSON null decodes to Lua nil and object nulls become absent keys via lua_setfield, so the panel nil checks and the contract test serializer are correct as written; finding recorded in docs/notes/noctalia-plugin-contract.md.
