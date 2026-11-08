import type { EngineInterface, PluginOptions, Register } from 'claude-code'

/** Where macOS keeps its built-in alert sounds; nothing is bundled. */
export const SYSTEM_SOUNDS = '/System/Library/Sounds'

/** Each agreed event: the userConfig key that toggles it and its sound. */
export const SOUNDS = {
  question: 'Ping',
  plan: 'Hero',
  permission: 'Funk',
  done: 'Glass',
  error: 'Basso',
  mcpInput: 'Submarine',
  idle: 'Purr',
  subagentDone: 'Pop',
  toolFailed: 'Bottle',
  autoCompact: 'Morse',
  taskDone: 'Blow',
} as const

type Kind = keyof typeof SOUNDS

/** The same event again within this window plays nothing (clips overlap). */
const REPEAT_MS = 1500

/** Tools that have their own sound, so their permission dialog stays quiet. */
const OWN_SOUND_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode'])

/** When each kind last played, for the repeat window; reset on reload. */
const lastPlayed = new Map<Kind, number>()

/** Plays the kind's system sound with afplay, unless off or just played. */
async function play($: EngineInterface, options: PluginOptions, kind: Kind) {
  if (options[kind] !== true) return
  const now = await $.clock.now()
  const last = lastPlayed.get(kind)
  if (last !== undefined && now - last < REPEAT_MS) return
  lastPlayed.set(kind, now)
  await $.process.run(['afplay', `${SYSTEM_SOUNDS}/${SOUNDS[kind]}.aiff`], {
    timeoutMs: 10_000,
  })
}

/** Starts the clip without awaiting it: no dialog or turn waits on sound. */
function fire($: EngineInterface, options: PluginOptions, kind: Kind) {
  play($, options, kind).catch(() => undefined)
}

export const register: Register = (on, options) => {
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e, next) => {
    fire($, options, 'question')
    return next(e)
  })

  on('tool.call', { tool: 'ExitPlanMode' }, ($, e, next) => {
    fire($, options, 'plan')
    return next(e)
  })

  on('classic.PermissionRequest', ($, e, next) => {
    if (!OWN_SOUND_TOOLS.has(e.tool_name)) fire($, options, 'permission')
    return next(e)
  })

  on('classic.Stop', ($, e, next) => {
    fire($, options, 'done')
    return next(e)
  })

  on('classic.StopFailure', ($, e, next) => {
    fire($, options, 'error')
    return next(e)
  })

  on('classic.Elicitation', ($, e, next) => {
    fire($, options, 'mcpInput')
    return next(e)
  })

  // permission_prompt and elicitation_dialog come ~6s late and would repeat
  // PermissionRequest and Elicitation; only the idle reminder is used here.
  on('classic.Notification', ($, e, next) => {
    if (e.notification_type === 'idle_prompt') fire($, options, 'idle')
    return next(e)
  })

  on('classic.SubagentStop', ($, e, next) => {
    fire($, options, 'subagentDone')
    return next(e)
  })

  on('classic.PostToolUseFailure', ($, e, next) => {
    if (e.is_interrupt !== true) fire($, options, 'toolFailed')
    return next(e)
  })

  on('classic.PreCompact', ($, e, next) => {
    if (e.trigger === 'auto') fire($, options, 'autoCompact')
    return next(e)
  })

  on('classic.TaskCompleted', ($, e, next) => {
    fire($, options, 'taskDone')
    return next(e)
  })
}
