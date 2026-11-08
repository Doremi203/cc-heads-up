# cc-heads-up

Sound cues for Claude Code on macOS. Each agent event that needs your attention plays its own built-in macOS sound, so you can tell what happened without looking: a question, a plan ready for review, a permission prompt, a finished turn or a failure.

- No dependencies and no bundled audio: it runs `afplay` on the sounds in `/System/Library/Sounds`.
- No background processes: everything runs from Claude Code hooks.
- Works in regular sessions and in background sessions under `claude agents`.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install cc-heads-up --marketplace Doremi203/cc-heads-up
```

Answer `y` to add the marketplace, then pick a scope (user is recommended).

From a shell:

```
claude plugin install cc-heads-up --marketplace Doremi203/cc-heads-up
```

## Events and sounds

| # | Event | Hook | Sound | Default |
|---|---|---|---|---|
| 1 | Asks a question | `tool.call` AskUserQuestion | Ping | on |
| 2 | Plan ready for review | `tool.call` ExitPlanMode | Hero | on |
| 3 | Permission prompt (instant) | `classic.PermissionRequest` | Funk | on |
| 4 | Turn finished | `classic.Stop` | Glass | on |
| 5 | Turn failed (API error, rate limit, auth) | `classic.StopFailure` | Basso | on |
| 6 | Idle reminder, ~60 s after the reply | `classic.Notification` idle_prompt | Purr | off |
| 7 | MCP server asks for input | `classic.Elicitation` | Submarine | on |
| 8 | Subagent finished | `classic.SubagentStop` | Pop | off |
| 9 | Tool failed (interrupts excluded) | `classic.PostToolUseFailure` | Bottle | off |
| 10 | Auto-compact | `classic.PreCompact` auto | Morse | off |
| 11 | Task completed | `classic.TaskCompleted` | Blow | off |

Turn each event on or off in `/config` (or `/plugin configure cc-heads-up@cc-heads-up`).

Notes:

- The same event within 1.5 s plays once, so clips do not pile up.
- AskUserQuestion and ExitPlanMode have their own sounds, so their permission dialog plays no extra Funk.
- The delayed `permission_prompt` and `elicitation_dialog` notifications (~6 s) are ignored on purpose; events 3 and 7 already fire instantly.
- CLI only: the desktop app and the VS Code extension play nothing.

## Requirements

- macOS (uses `afplay` and `/System/Library/Sounds`)
- A Claude Code build with plugin hooks modules (mods)

## Development

```
claude plugin validate .
claude plugin test .
```

## License

MIT
