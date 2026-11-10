#!/bin/sh
# cc-heads-up: plays the macOS system sound of one Claude Code event.
#   play.sh <kind>
# <kind> is a userConfig key. Claude Code exports each saved option as
# $CLAUDE_PLUGIN_OPTION_<KEY>; an option never saved falls back to the
# default below. The hook's JSON input arrives on stdin.

kind=$1

case $kind in
  question)     sound=Ping;      default=true ;;
  plan)         sound=Hero;      default=true ;;
  permission)   sound=Funk;      default=true ;;
  done)         sound=Glass;     default=true ;;
  error)        sound=Basso;     default=true ;;
  mcpInput)     sound=Submarine; default=true ;;
  idle)         sound=Purr;      default=false ;;
  subagentDone) sound=Pop;       default=false ;;
  toolFailed)   sound=Bottle;    default=false ;;
  autoCompact)  sound=Morse;     default=false ;;
  taskDone)     sound=Blow;      default=false ;;
  *) exit 0 ;;
esac

upper=$(printf %s "$kind" | tr '[:lower:]' '[:upper:]')
eval "enabled=\${CLAUDE_PLUGIN_OPTION_$upper:-$default}"
[ "$enabled" = true ] || exit 0

input=$(cat)

# AskUserQuestion and ExitPlanMode have their own sounds: their permission
# dialog stays quiet. A tool the user interrupted is not a failure.
case $kind in
  permission)
    printf %s "$input" | grep -Eq '"tool_name" *: *"(AskUserQuestion|ExitPlanMode)"' && exit 0 ;;
  toolFailed)
    printf %s "$input" | grep -Eq '"is_interrupt" *: *true' && exit 0 ;;
esac

# The same event again within 1.5 s plays once, across every session, so
# parallel agents finishing together do not pile clips up.
dir=${CLAUDE_PLUGIN_DATA:-${TMPDIR:-/tmp}/cc-heads-up}
mkdir -p "$dir" 2>/dev/null
stamp=$dir/last-$kind
now=$(perl -MTime::HiRes=time -e 'printf "%d", time * 1000')
last=$(cat "$stamp" 2>/dev/null)
[ -n "$last" ] && [ $((now - last)) -lt 1500 ] && exit 0
printf %s "$now" > "$stamp"

file=/System/Library/Sounds/$sound.aiff
if [ -n "$CC_HEADS_UP_DRY_RUN" ]; then
  printf '%s %s\n' "$kind" "$file" >> "$CC_HEADS_UP_DRY_RUN"
  exit 0
fi

# Detached, so the hook returns at once and the clip finishes even when the
# session exits right after Stop (claude -p).
nohup afplay "$file" </dev/null >/dev/null 2>&1 &
