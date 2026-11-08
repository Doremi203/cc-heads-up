import type { Engine } from 'claude-code/testing'
import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

/** The classic events the mod hooks: the engine's settings hooks answer them. */
const CLASSIC = [
  'classic.PermissionRequest',
  'classic.Stop',
  'classic.StopFailure',
  'classic.Elicitation',
  'classic.Notification',
  'classic.SubagentStop',
  'classic.PostToolUseFailure',
  'classic.PreCompact',
  'classic.TaskCompleted',
] as const

/** Stands for the engine beneath the mod: classic hooks with no say. */
const engineBottom = (on: On) => {
  for (const name of CLASSIC) on(name, () => ({}))
}

/** Stands for the engine beneath the mod: records clips, answers each call. */
const harness = (on: On) => {
  engineBottom(on)
  const played: string[] = []
  let now = 1_000_000
  on('process.run', (_, e) => {
    played.push(e.argv.join(' '))
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('clock.now', () => ({ value: now }))
  on('tool.call', () => ({ result: {} }))
  return {
    played,
    advance: (ms: number) => {
      now += ms
    },
  }
}

/** The mod starts its clip without awaiting it: let that work settle. */
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

const ALL_ON = {
  question: true,
  plan: true,
  permission: true,
  done: true,
  error: true,
  mcpInput: true,
  idle: true,
  subagentDone: true,
  toolFailed: true,
  autoCompact: true,
  taskDone: true,
}

type Case = {
  name: string
  sound: string
  isOnByDefault: boolean
  raise: ($: Engine) => Promise<unknown>
}

const CASES: Case[] = [
  {
    name: '1 asks a question',
    sound: 'afplay /System/Library/Sounds/Ping.aiff',
    isOnByDefault: true,
    raise: $ =>
      $.tool.call({
        tool: 'AskUserQuestion',
        questions: [
          {
            question: 'Which?',
            header: 'Pick',
            multiSelect: false,
            options: [
              { label: 'A', description: 'a' },
              { label: 'B', description: 'b' },
            ],
          },
        ],
      } as never),
  },
  {
    name: '2 plan ready',
    sound: 'afplay /System/Library/Sounds/Hero.aiff',
    isOnByDefault: true,
    raise: $ => $.tool.call({ tool: 'ExitPlanMode', plan: '# Plan' } as never),
  },
  {
    name: '3 permission prompt',
    sound: 'afplay /System/Library/Sounds/Funk.aiff',
    isOnByDefault: true,
    raise: $ =>
      $.classic.PermissionRequest({
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf build' },
      } as never),
  },
  {
    name: '4 turn finished',
    sound: 'afplay /System/Library/Sounds/Glass.aiff',
    isOnByDefault: true,
    raise: $ => $.classic.Stop({ stop_hook_active: false } as never),
  },
  {
    name: '5 turn failed',
    sound: 'afplay /System/Library/Sounds/Basso.aiff',
    isOnByDefault: true,
    raise: $ => $.classic.StopFailure({ error: 'rate_limit' } as never),
  },
  {
    name: '7 MCP asks for input',
    sound: 'afplay /System/Library/Sounds/Submarine.aiff',
    isOnByDefault: true,
    raise: $ =>
      $.classic.Elicitation({
        mcp_server_name: 'github',
        message: 'Token?',
      } as never),
  },
  {
    name: '6 idle reminder',
    sound: 'afplay /System/Library/Sounds/Purr.aiff',
    isOnByDefault: false,
    raise: $ =>
      $.classic.Notification({
        message: 'Claude is waiting for your input',
        notification_type: 'idle_prompt',
      } as never),
  },
  {
    name: '8 subagent finished',
    sound: 'afplay /System/Library/Sounds/Pop.aiff',
    isOnByDefault: false,
    raise: $ =>
      $.classic.SubagentStop({
        stop_hook_active: false,
        agent_id: 'a1',
        agent_transcript_path: '',
        agent_type: 'Explore',
      } as never),
  },
  {
    name: '9 tool failed',
    sound: 'afplay /System/Library/Sounds/Bottle.aiff',
    isOnByDefault: false,
    raise: $ =>
      $.classic.PostToolUseFailure({
        tool_name: 'Bash',
        tool_input: { command: 'false' },
        tool_use_id: 't1',
        error: 'exit 1',
      } as never),
  },
  {
    name: '10 auto-compact',
    sound: 'afplay /System/Library/Sounds/Morse.aiff',
    isOnByDefault: false,
    raise: $ =>
      $.classic.PreCompact({
        trigger: 'auto',
        custom_instructions: null,
      } as never),
  },
  {
    name: '11 task completed',
    sound: 'afplay /System/Library/Sounds/Blow.aiff',
    isOnByDefault: false,
    raise: $ =>
      $.classic.TaskCompleted({ task_id: '1', task_subject: 'Write tests' } as never),
  },
]

for (const c of CASES) {
  test(`${c.name}: plays ${c.sound} when on`, { options: ALL_ON }, async ($, on) => {
    const h = harness(on)
    await c.raise($)
    await settle()
    expect(h.played).toEqual([c.sound])
  })

  test(`${c.name}: default is ${c.isOnByDefault ? 'on' : 'off'}`, async ($, on) => {
    const h = harness(on)
    await c.raise($)
    await settle()
    expect(h.played).toEqual(c.isOnByDefault ? [c.sound] : [])
  })
}

test('a permission dialog for AskUserQuestion or ExitPlanMode plays no second sound', { options: ALL_ON }, async ($, on) => {
  const h = harness(on)
  await $.classic.PermissionRequest({ tool_name: 'AskUserQuestion', tool_input: {} } as never)
  await $.classic.PermissionRequest({ tool_name: 'ExitPlanMode', tool_input: {} } as never)
  await settle()
  expect(h.played).toEqual([])
})

test('late Notification types that repeat instant hooks stay quiet', { options: ALL_ON }, async ($, on) => {
  const h = harness(on)
  for (const type of ['permission_prompt', 'elicitation_dialog', 'auth_success']) {
    await $.classic.Notification({ message: 'x', notification_type: type } as never)
  }
  await settle()
  expect(h.played).toEqual([])
})

test('an interrupted tool and a manual compact stay quiet', { options: ALL_ON }, async ($, on) => {
  const h = harness(on)
  await $.classic.PostToolUseFailure({
    tool_name: 'Bash',
    tool_input: {},
    tool_use_id: 't1',
    error: 'interrupted',
    is_interrupt: true,
  } as never)
  await $.classic.PreCompact({ trigger: 'manual', custom_instructions: null } as never)
  await settle()
  expect(h.played).toEqual([])
})

test('the same event within 1.5s plays once, later again', async ($, on) => {
  const h = harness(on)
  await $.classic.Stop({ stop_hook_active: false } as never)
  await settle()
  h.advance(500)
  await $.classic.Stop({ stop_hook_active: false } as never)
  await settle()
  expect(h.played).toEqual(['afplay /System/Library/Sounds/Glass.aiff'])
  h.advance(1500)
  await $.classic.Stop({ stop_hook_active: false } as never)
  await settle()
  expect(h.played).toEqual(['afplay /System/Library/Sounds/Glass.aiff', 'afplay /System/Library/Sounds/Glass.aiff'])
})

test('a failing player never breaks the event', async ($, on) => {
  engineBottom(on)
  on('process.run', () => {
    throw new Error('no afplay')
  })
  on('clock.now', () => ({ value: 0 }))
  const result = await $.classic.Stop({ stop_hook_active: false } as never)
  expect(result).toBeDefined()
})
