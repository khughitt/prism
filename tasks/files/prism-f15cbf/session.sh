#!/usr/bin/env bash
# Short panel-budget comparison: snapshot, swap one variant in, restore.
#   session.sh begin          save pointer/active.json/log offset, pause rotation
#   session.sh use <B1|C1|..> point the shell's plugin link at that copy, reload
#   session.sh end            restore pointer, active.json, rotation; reload
set -euo pipefail
S=$(cd "$(dirname "$0")/.." && pwd)
LINK=$HOME/.local/share/noctalia/plugins/prism
ACTIVE=$HOME/.local/state/prism/active.json
LOG=$HOME/.cache/noctalia/noctalia.log

# The panel's script watch sits on the directory the link named when the panel
# first opened (cached by path string: the main checkout); an empty append there reloads through the link.
WATCHED=${PRISM_CHECKOUT:?set PRISM_CHECKOUT to the main checkout}/integrations/noctalia-plugin/panel.luau
reload() {
  printf '' >> "$WATCHED"
  sleep 2
}

case "$1" in
  begin)
    [[ ! -e $S/saved ]] || { echo "already begun" >&2; exit 1; }
    mkdir "$S/saved"
    readlink "$LINK" > "$S/saved/link"
    cp -p "$ACTIVE" "$S/saved/active.json"
    printf '%s %s\n' "$(stat -c %i "$LOG")" "$(stat -c %s "$LOG")" > "$S/saved/log-offset"
    systemctl --user is-active wali-rotate.timer > "$S/saved/timer" || true
    systemctl --user stop wali-rotate.timer
    echo "saved: link=$(cat "$S/saved/link") timer=$(cat "$S/saved/timer")"
    ;;
  use)
    [[ -d $S/plugins/$2 ]]
    ln -sfn "$S/plugins/$2" "$LINK"
    reload
    grep -e "PRISMPROBE [0-9]* $2 0 loaded" -e "hot reload" "$LOG" | tail -2
    ;;
  end)
    noctalia msg panel-close khughitt/prism:panel >/dev/null 2>&1 || true
    ln -sfn "$(cat "$S/saved/link")" "$LINK"
    reload
    if ! cmp -s "$ACTIVE" "$S/saved/active.json"; then
      cp -p "$S/saved/active.json" "$ACTIVE.restore.$$"
      mv "$ACTIVE.restore.$$" "$ACTIVE"
      prism apply >/dev/null
      echo "active.json restored and applied"
    fi
    cmp "$ACTIVE" "$S/saved/active.json" && echo "active.json matches snapshot"
    if [[ $(cat "$S/saved/timer") == active ]]; then systemctl --user start wali-rotate.timer; fi
    echo "link=$(readlink "$LINK") timer=$(systemctl --user is-active wali-rotate.timer)"
    ;;
esac
