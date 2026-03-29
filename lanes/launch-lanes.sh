#!/usr/bin/env bash
# Launch all lane tmux sessions
# Usage: ./launch-lanes.sh [lane]   (no arg = launch all)

LANES=(worklab businessops financemanager socialhub)
DIRS=(WorkLab BusinessOps FinanceManager SocialHub)
BASE=~/OpenClaw/lanes

launch() {
  local name=$1
  local dir=$2
  if tmux has-session -t "$name" 2>/dev/null; then
    echo "[$name] already running"
  else
    tmux new-session -d -s "$name" -c "$BASE/$dir"
    echo "[$name] started → $BASE/$dir"
  fi
}

if [ -n "$1" ]; then
  for i in "${!LANES[@]}"; do
    [[ "${LANES[$i]}" == "$1" ]] && launch "${LANES[$i]}" "${DIRS[$i]}"
  done
else
  for i in "${!LANES[@]}"; do
    launch "${LANES[$i]}" "${DIRS[$i]}"
  done
fi
