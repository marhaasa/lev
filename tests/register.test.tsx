import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { Profile } from '../types'

const SESSION = { cwd: '/work', surface: 'terminal', isInteractive: true } as const
const NOW = Date.UTC(2026, 9, 22, 10, 0, 0)
const COMPOSE = { model: 'm', promptModel: 'm', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as const
const PANE = {
  plugin: 'zpd',
  component: 'Pane',
  requestId: 'zpd',
  props: {
    title: 'ZPD',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

type World = {
  commands: string[]
  tools: string[]
  opened: string[]
  status: (string | undefined)[]
  logs: string[]
}

/** The engine beneath the plugin: each hook here stands for it. */
function worldOf(on: On, entries?: Readonly<Record<string, unknown>>): World {
  const world: World = { commands: [], tools: [], opened: [], status: [], logs: [] }

  mock.store(on, entries)
  mock.clock(on, { now: NOW })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => {
    world.commands.push(e.name)

    return { value: { command: e.name } }
  })
  on('tool.register', (_, e) => {
    world.tools.push(e.name)

    return { value: { tool: `mcp__zpd__${e.name}` } }
  })
  on('ui.open', (_, e) => {
    world.opened.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('ui.status', (_, e) => {
    world.status.push(e.text)

    return { value: undefined }
  })
  on('ui.log', (_, e) => {
    world.logs.push(e.text)

    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('tool.call', () => ({ result: 'ok', text: 'ok' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('classic.Stop', () => ({}))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'engine', scope: 'shared' as const }] }))

  return world
}

const ORIGIN = { kind: 'composer' } as const
const PRESENTATION = { isFullscreen: true, columns: 120 } as const

/** `/zpd <args>` as the person types it. */
const runOf = ($: Engine) => (args: string) => $.command.run({ command: 'zpd', args, origin: ORIGIN, presentation: PRESENTATION })

/** The learner model as the plugin holds it, read back through `/zpd json`. */
async function storedOf($: Engine): Promise<Profile> {
  const dump = await runOf($)('json')
  const text = dump.text ?? ''

  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Profile
}

const turn = { answer: 'done', durationMs: 5, isAborted: false, reason: 'answer' } as const

test('the start registers the two tools and the command, counts the session and sets the status line', async ($, on) => {
  const run = runOf($)
  const world = worldOf(on)

  await $.session.start(SESSION)

  expect(world.tools.sort()).toEqual(['profile', 'record'])
  expect(world.commands).toEqual(['zpd'])
  expect(world.status.at(-1)).toBe('zpd · balanced · 0 in zone')

  const stored = await storedOf($)

  expect(stored.sessions).toBe(1)
  expect(stored.mode).toBe('balanced')
})

test('a store holding garbage is replaced, not crashed on', async ($, on) => {
  const world = worldOf(on, { profile: 'garbage' })

  await $.session.start(SESSION)

  expect(world.status.at(-1)).toContain('balanced')
})

test('the record tool applies the contingent shift and tells the model the new level; a bad record is refused', async ($, on) => {
  worldOf(on)
  await $.session.start(SESSION)

  const first = await $.tool.call({ tool: 'mcp__zpd__record', skill: 'Git Rebase', kind: 'success' })

  expect(first.deny).toBeUndefined()
  expect(String(first.result)).toContain('git-rebase: new → proximal L1 orient')

  const second = await $.tool.call({ tool: 'mcp__zpd__record', skill: 'git-rebase', kind: 'success' })

  expect(String(second.result)).toContain('→ independent')
  expect(String(second.result)).toContain('hand it over')

  const bad = await $.tool.call({ tool: 'mcp__zpd__record', skill: 'git-rebase', kind: 'nope' })

  expect(bad.deny).toContain('kind must be one of')

  const read = await $.tool.call({ tool: 'mcp__zpd__profile', skill: 'git-rebase' })

  expect(String(read.result)).toContain('git-rebase: independent')
  expect(String(read.result)).toContain('success → independent L0')
})

test('the system prompt gets a session section with the protocol and the snapshot, except where nobody is learning', async ($, on) => {
  const run = runOf($)
  worldOf(on)
  await $.session.start(SESSION)
  await run('set git-rebase proximal 3')

  const composed = await $.prompt.compose(COMPOSE)
  const section = composed.sections.at(-1)

  expect(composed.sections[0]?.id).toBe('intro')
  expect(section?.id).toBe('zpd:protocol')
  expect(section?.scope).toBe('session')
  expect(section?.text).toContain('git-rebase L3 partial')
  expect(section?.text).toContain('How to work in balanced mode')
  expect(section?.text).toContain('mcp__zpd__record')

  const bare = await $.prompt.compose({ ...COMPOSE, traits: ['bare'] })

  expect(bare.sections.map(s => s.id)).toEqual(['intro'])
})

test('a record by the model does not move the snapshot the prompt reads; a /zpd command does', async ($, on) => {
  const run = runOf($)
  worldOf(on)
  await $.session.start(SESSION)
  await $.tool.call({ tool: 'mcp__zpd__record', skill: 'react-hooks', kind: 'exposed' })

  const before = await $.prompt.compose(COMPOSE)

  expect(before.sections.at(-1)?.text).toContain('- nothing placed yet')

  await run('goal react-hooks')

  const after = await $.prompt.compose(COMPOSE)

  expect(after.sections.at(-1)?.text).toContain('- beyond: react-hooks (seen 1/3) ★')
  expect(after.sections.at(-1)?.text).toContain('goals (★): react-hooks')
})

test('/zpd mode learn switches the mode and the Stop check then holds a turn that changed files until a record lands', async ($, on) => {
  const run = runOf($)
  const world = worldOf(on)

  await $.session.start(SESSION)

  const switched = await run('mode learn')

  expect(switched.text).toContain('Mode: learn')
  expect(switched.context?.[0]).toContain('learn')
  expect(world.status.at(-1)).toContain('zpd · learn')

  await $.turn.start({ text: 'fix it', turnId: 't1' })
  await $.tool.call({ tool: 'Edit', file_path: '/work/a.ts', old_string: 'a', new_string: 'b' })

  const held = await $.classic.Stop({ stop_hook_active: false })

  expect(held.block).toContain('learn mode')

  const second = await $.classic.Stop({ stop_hook_active: true })

  expect(second.block).toBeUndefined()

  await $.tool.call({ tool: 'mcp__zpd__record', skill: 'typescript-generics', kind: 'exposed' })

  const recorded = await $.classic.Stop({ stop_hook_active: false })

  expect(recorded.block).toBeUndefined()

  await $.turn.start({ text: 'what does this do?', turnId: 't2' })

  const noEdits = await $.classic.Stop({ stop_hook_active: false })

  expect(noEdits.block).toBeUndefined()
})

test('with the check switched off, learn mode holds nothing', { options: { enforce: false } }, async ($, on) => {
  const run = runOf($)
  worldOf(on)
  await $.session.start(SESSION)
  await run('mode learn')
  await $.turn.start({ text: 'fix it', turnId: 't1' })
  await $.tool.call({ tool: 'Write', file_path: '/work/a.ts', content: 'x' })

  const stop = await $.classic.Stop({ stop_hook_active: false })

  expect(stop.block).toBeUndefined()
})

test('in balanced mode nothing is held; a nudge is logged for unrecorded work, then not again for a few turns', async ($, on) => {
  const world = worldOf(on)

  await $.session.start(SESSION)
  await $.turn.start({ text: 'fix it', turnId: 't1' })
  await $.tool.call({ tool: 'Edit', file_path: '/work/a.ts', old_string: 'a', new_string: 'b' })

  expect((await $.classic.Stop({ stop_hook_active: false })).block).toBeUndefined()

  await $.turn.complete({ ...turn, turnId: 't1' })

  expect(world.logs.length).toBe(1)
  expect(world.logs[0]).toContain('1 edit this turn')
  expect(world.status.at(-1)).toBe('zpd · balanced · 0 in zone · 1 edits, 0 recorded')

  await $.turn.start({ text: 'and this', turnId: 't2' })
  await $.tool.call({ tool: 'Edit', file_path: '/work/b.ts', old_string: 'a', new_string: 'b' })
  await $.turn.complete({ ...turn, turnId: 't2' })

  expect(world.logs.length).toBe(1)
})

test('in ship mode there is no nudge and the prompt section is short', async ($, on) => {
  const run = runOf($)
  const world = worldOf(on)

  await $.session.start(SESSION)
  await run('mode ship')
  await $.turn.start({ text: 'fix it', turnId: 't1' })
  await $.tool.call({ tool: 'Edit', file_path: '/work/a.ts', old_string: 'a', new_string: 'b' })
  await $.turn.complete({ ...turn, turnId: 't1' })

  expect(world.logs).toEqual([])

  const section = (await $.prompt.compose(COMPOSE)).sections.at(-1)

  expect(section?.text).toContain('ship mode')
  expect(section?.text).not.toContain('Support levels')
})

test('/zpd status, goal, forget and reset read and write the model', async ($, on) => {
  const run = runOf($)
  worldOf(on)
  await $.session.start(SESSION)

  const empty = await run('')

  expect(empty.text).toContain('No skills placed yet')

  const goal = await run('goal sql-window-functions')

  expect(goal.text).toContain('★ sql-window-functions is a goal')

  const status = await run('status')

  expect(status.text).toContain('proximal — your zone')
  expect(status.text).toContain('★ sql-window-functions')
  expect(status.text).toContain('goals: sql-window-functions')

  const forgot = await run('forget sql-window-functions')

  expect(forgot.text).toBe('sql-window-functions forgotten.')

  const unsure = await run('reset')

  expect(unsure.text).toContain('/zpd reset confirm')

  await run('set git-rebase beyond')
  await run('reset confirm')

  const stored = await storedOf($)

  expect(Object.keys(stored.skills)).toEqual([])
  expect(stored.sessions).toBe(1)

  const help = await run('whatever')

  expect(help.text).toContain('/zpd mode <m>')
})

test('the pane lists skills by zone on every surface, and its buttons switch the mode', async ($, on) => {
  const run = runOf($)
  worldOf(on)
  await $.session.start(SESSION)
  await run('set git-rebase proximal 2')
  await run('set git-basics independent')

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Text', text: /git-rebase/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /git-basics/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^proximal$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^independent$/ })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'mode-learn' })

  const stored = await storedOf($)

  expect(stored.mode).toBe('learn')
  await ui.unmount()
})

test('the pane opens unasked only where the layout docks it beside the transcript', async ($, on) => {
  const world = worldOf(on)

  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  await $.session.start(SESSION)

  const band = {
    component: 'AbovePrompt',
    surface: 'terminal',
    requestId: 'band',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  } as const

  await $.ui.render({ ...band, viewport: { columns: 100, rows: 40, isFullscreen: false } })

  expect(world.opened).toEqual([])

  await $.session.start(SESSION)
  await $.ui.render({ ...band, viewport: { columns: 200, rows: 40, isFullscreen: true } })

  expect(world.opened).toEqual(['zpd'])
})
