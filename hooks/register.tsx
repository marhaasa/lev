/**
 * lev: a Zone of Proximal Development harness for Claude Code.
 *
 * What this module wires, event by event:
 * - session.start    loads the learner model from `$.store`, registers the two
 *                    tools and the /lev command, sets the status line
 * - prompt.compose   appends the ZPD section (the protocol and a snapshot of
 *                    the model) to the system prompt; the snapshot changes
 *                    only at session start and on /lev commands, so the
 *                    prompt cache holds through a turn
 * - tool.call        serves mcp__lev__profile and mcp__lev__record, and counts
 *                    file-changing calls
 * - turn.start/complete  per-turn counters, the status line, the nudge
 * - classic.Stop     in learn mode, holds a turn that changed files until the
 *                    model has recorded what it did (once per turn)
 * - command.run      /lev status | mode | set | goal | forget | pane | json | reset | help
 * - ui.render        the learning-map pane, and the auto-open of it in a
 *                    fullscreen layout
 *
 * The learner model's rules live in ./model.ts and the prompt text in
 * ./protocol.ts; neither touches `$`.
 */
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mode, Profile, Skill, Zone } from '../types'

import {
  applyRecord,
  coerceProfile,
  detailOf,
  emptyProfile,
  emptyStats,
  goalsOf,
  groupSkills,
  isMode,
  isZone,
  KINDS,
  MAX_SUPPORT,
  MODE_BLURB,
  MODES,
  normalizeSkillName,
  NUDGE_EVERY_TURNS,
  nudgeTextOf,
  parseArgs,
  parseRecordInput,
  profileTextOf,
  statusLineOf,
  statusTextOf,
  supportBar,
  ZONE_LABEL,
  ZONES,
} from './model'
import { protocolOf, SECTION_ID } from './protocol'

const PANE = 'lev'
const STORE_KEY = 'profile'
const TOOL_PROFILE = 'mcp__lev__profile'
const TOOL_RECORD = 'mcp__lev__record'
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
/** System prompts this section does not belong in: no person is learning at the other end. */
const SKIP_TRAITS = new Set(['bare', 'print', 'teammate', 'sdk-preset'])

const profileAtom = atom({ plugin: 'lev', key: 'profile' } as const, null)
const statsAtom = atom({ plugin: 'lev', key: 'stats' } as const, emptyStats())

const PROFILE_TOOL = {
  name: 'profile',
  description:
    "Read the person's learner model kept by the lev plugin: each skill's zone (independent, proximal, beyond), its support level, streak and goals. Pass `skill` for one entry with its recent history. Fresher than the snapshot in the system prompt.",
  inputSchema: {
    type: 'object',
    properties: {
      skill: { type: 'string', description: 'One skill, lowercase-kebab-case (git-rebase). Leave out for the whole model.' },
    },
  },
  isDeferred: false,
} as const

const RECORD_TOOL = {
  name: 'record',
  description:
    "Record evidence about one skill in the person's learner model (lev). kind: success (they did the step at the current support), struggle (they could not), explained (a teach-back passed), exposed (you did it fully in front of them), assessed (an assessment placed it: give zone and support). The result names the new support level: use it next time. Skill names are lowercase-kebab-case; reuse existing names.",
  inputSchema: {
    type: 'object',
    properties: {
      skill: { type: 'string', description: 'The skill, lowercase-kebab-case (git-rebase, react-hooks).' },
      kind: { type: 'string', enum: [...KINDS], description: 'What happened.' },
      zone: { type: 'string', enum: [...ZONES], description: 'With kind assessed: where the assessment placed it.' },
      support: { type: 'integer', minimum: 0, maximum: MAX_SUPPORT, description: 'With kind assessed: the first level at which they succeeded (0 unaided, 4 not even with help).' },
      note: { type: 'string', description: 'One line: what the sticking point or the step was.' },
    },
    required: ['skill', 'kind'],
  },
  isDeferred: false,
} as const

const COMMAND = {
  name: 'lev',
  description: 'Your learning map: zones, support levels, goals and mode (status | mode | set | goal | forget | pane | json | reset | help)',
  argumentHint: '[status | mode learn|balanced|ship | set <skill> <zone> [0-4] | goal <skill> | forget <skill> | pane | help]',
  immediate: true,
} as const

const STOP_REASON =
  'lev (learn mode): you changed files this turn but recorded nothing in the learner model. Before you stop: (1) name the one to three skills this work touched, reusing names from mcp__lev__profile where they fit; (2) for each, call mcp__lev__record: `exposed` if you did it for them, `success` or `struggle` if they did a step themselves; (3) if any of them is in their proximal zone, end with ONE short check question (predict, explain, or change one line). If the change was trivial and touched no skill worth learning, say so in one line and stop.'

const HELP = [
  '/lev                          the map: zones, support levels, goals',
  '/lev mode <m>                 learn | balanced | ship',
  '/lev set <skill> <zone> [0-4] place a skill yourself: independent | proximal | beyond, and the support level',
  '/lev goal <skill>             toggle a goal (Claude prefers handing these over); /lev goal clear',
  '/lev forget <skill>           remove a skill',
  '/lev pane                     open the learning-map pane',
  '/lev json                     the raw learner model',
  '/lev reset confirm            start over',
  '',
  'Model-driven: /lev:assess <skill> places one by how much help you need · /lev:explain teaches it back · /lev:handover gives the work to you · /lev:review before you leave',
].join('\n')

const wholeOf = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0)

const isoOf = (ms: number): string => new Date(ms).toISOString()

const fit = (text: string, width: number): string => (text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length))

/**
 * The model as the system prompt reads it: refreshed at the start and on
 * /lev commands, never by a tool call, so the prompt cache holds through a turn.
 */
let snapshot: { profile: Profile; at: string } | null = null
/** Whether the auto-open of the pane has been decided for this session. */
let isPaneSettled = true

async function nowOf($: EngineInterface): Promise<string> {
  return isoOf(await $.clock.now())
}

async function profileOf($: EngineInterface, now: string): Promise<Profile> {
  const held = await read($, profileAtom)

  return held ?? coerceProfile(await $.store.get(STORE_KEY), now)
}

async function save($: EngineInterface, profile: Profile, refreshesPrompt: boolean): Promise<void> {
  await $.store.set(STORE_KEY, profile)
  await update($, profileAtom, () => profile)

  if (refreshesPrompt) {
    snapshot = { profile, at: profile.updatedAt }
  }

  $.ui.status(statusLineOf(profile, await read($, statsAtom)))
}

async function setMode($: EngineInterface, mode: Mode): Promise<Profile> {
  const now = await nowOf($)
  const profile = await profileOf($, now)

  if (profile.mode === mode) {
    return profile
  }

  const next: Profile = { ...profile, mode, updatedAt: now }

  await save($, next, true)

  return next
}

export const register: Register = (on, options) => {
  // ------------------------------------------------------------- lifecycle

  on('session.start', async ($, e, next) => {
    const now = await nowOf($)
    const loaded = coerceProfile(await $.store.get(STORE_KEY), now)
    const profile: Profile = { ...loaded, sessions: loaded.sessions + 1, updatedAt: now }

    await update($, statsAtom, () => emptyStats())
    await save($, profile, true)
    isPaneSettled = options.pane !== 'auto' || !e.isInteractive

    await Promise.all([
      $.tool.register(PROFILE_TOOL).catch(() => undefined),
      $.tool.register(RECORD_TOOL).catch(() => undefined),
      $.command.register(COMMAND).catch(() => undefined),
    ])

    return next(e)
  })

  // A pane opened unasked is a sidebar in a fullscreen layout and a takeover
  // on the main screen, so the first drawing that says which decides.
  on('ui.render', { component: ['PromptHint', 'AbovePrompt'] }, ($, e, next) => {
    if (!isPaneSettled && e.viewport?.isFullscreen !== undefined) {
      isPaneSettled = true

      if (e.viewport.isFullscreen) {
        void $.ui.open({ id: PANE, title: 'lev' }).catch(() => undefined)
      }
    }

    return next(e)
  })

  // --------------------------------------------------------- system prompt

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)

    if (e.traits.some(trait => SKIP_TRAITS.has(trait))) {
      return composed
    }

    const current = snapshot ?? { profile: await profileOf($, await nowOf($)), at: '' }

    return {
      sections: [...composed.sections, { id: SECTION_ID, text: protocolOf(current.profile, current.at), scope: 'session' as const }],
    }
  })

  // ----------------------------------------------------------------- tools

  on('tool.call', { tool: TOOL_PROFILE }, async ($, e) => {
    const args = e as unknown as Readonly<Record<string, unknown>>
    const profile = await profileOf($, await nowOf($))
    const skill = typeof args.skill === 'string' && args.skill.trim() !== '' ? normalizeSkillName(args.skill) : undefined

    return { result: profileTextOf(profile, skill) }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'lev: the learner model could not be read.' }))

  on('tool.call', { tool: TOOL_RECORD }, async ($, e) => {
    const args = e as unknown as Readonly<Record<string, unknown>>
    const parsed = parseRecordInput(args)

    if (!parsed.ok) {
      return { deny: `lev record: ${parsed.reason}` }
    }

    const now = await nowOf($)
    const outcome = applyRecord(await profileOf($, now), parsed.input, now)

    await save($, outcome.profile, false)
    await update($, statsAtom, stats => ({ ...stats, turnRecords: stats.turnRecords + 1, sessionRecords: stats.sessionRecords + 1 }))

    return { result: outcome.summary }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'lev: the record could not be written.' }))

  on('tool.call', async ($, e, next) => {
    if (!WRITE_TOOLS.has(String(e.tool))) {
      return next(e)
    }

    const ran = await next(e)

    if (ran.deny === undefined && ran.isError !== true) {
      await update($, statsAtom, stats => ({ ...stats, turnEdits: stats.turnEdits + 1, sessionEdits: stats.sessionEdits + 1 }))
    }

    return ran
  }).catch(($, e, next) => next(e))

  // ----------------------------------------------------------------- turns

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, statsAtom, stats => ({ ...stats, turns: stats.turns + 1, turnEdits: 0, turnRecords: 0 }))
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      return next(e)
    }

    const [profile, stats] = await Promise.all([read($, profileAtom), read($, statsAtom)])

    if (profile === null) {
      return next(e)
    }

    $.ui.status(statusLineOf(profile, stats))

    const isDue = stats.lastNudgeTurn === null || stats.turns - stats.lastNudgeTurn >= NUDGE_EVERY_TURNS
    const isUnrecordedWork = stats.turnEdits > 0 && stats.turnRecords === 0

    if (options.nudges === true && e.reason === 'answer' && profile.mode !== 'ship' && isUnrecordedWork && isDue) {
      $.ui.log(nudgeTextOf(stats))
      await update($, statsAtom, held => ({ ...held, lastNudgeTurn: held.turns }))
    }

    return next(e)
  })

  // In learn mode a turn that changed files is held once until the model has
  // recorded what it did. `stop_hook_active` is true on the second pass.
  on('classic.Stop', async ($, e, next) => {
    const below = await next(e)

    if (options.enforce !== true || e.stop_hook_active) {
      return below
    }

    const [profile, stats] = await Promise.all([read($, profileAtom), read($, statsAtom)])

    if (profile === null || profile.mode !== 'learn' || stats.turnEdits === 0 || stats.turnRecords > 0) {
      return below
    }

    return { ...below, block: STOP_REASON }
  }).catch(($, e, next) => next(e))

  // --------------------------------------------------------------- command

  on('command.run', { command: 'lev' }, async ($, e) => {
    const [verb = 'status', ...rest] = parseArgs(e.args)
    const now = await nowOf($)
    const profile = await profileOf($, now)
    const stats = await read($, statsAtom)
    const width = Math.max(40, wholeOf(e.presentation.columns) || 80)

    switch (verb.toLowerCase()) {
      case 'status':
      case 'map':
        return { text: statusTextOf(profile, stats, width) }

      case 'json':
        return { text: '```json\n' + JSON.stringify(profile, null, 2) + '\n```' }

      case 'mode': {
        const mode = rest[0]?.toLowerCase()

        if (!isMode(mode)) {
          return { text: `Mode is ${profile.mode}: ${MODE_BLURB[profile.mode]}\nUsage: /lev mode learn | balanced | ship` }
        }

        const next = await setMode($, mode)

        return {
          text: `Mode: ${next.mode}. ${MODE_BLURB[next.mode]}`,
          context: [`lev: the person switched to ${mode} mode. Follow the ${mode} rules of the ZPD section from now on.`],
        }
      }

      case 'set': {
        const name = normalizeSkillName(rest[0] ?? '')
        const zone = rest[1]?.toLowerCase()

        if (name === '' || !isZone(zone)) {
          return { text: 'Usage: /lev set <skill> independent | proximal | beyond [support 0-4]' }
        }

        const support = rest[2] !== undefined ? Number(rest[2]) : undefined
        const parsed = parseRecordInput({ skill: name, kind: 'set', zone, ...(support !== undefined && { support }), note: 'placed by the person' })

        if (!parsed.ok) {
          return { text: `Not set: ${parsed.reason}` }
        }

        const outcome = applyRecord(profile, parsed.input, now)

        await save($, outcome.profile, true)

        return {
          text: outcome.summary,
          context: [`lev: the person placed ${outcome.name} at ${outcome.after.zone} L${outcome.after.support}. Treat it so from now on.`],
        }
      }

      case 'goal': {
        const arg = rest[0]

        if (arg === undefined) {
          const goals = goalsOf(profile)

          return { text: goals.length === 0 ? 'No goals. /lev goal <skill> marks one; Claude then prefers handing it over.' : `goals: ${goals.join(', ')}` }
        }

        if (arg.toLowerCase() === 'clear') {
          const skills = Object.fromEntries(Object.entries(profile.skills).map(([name, skill]) => [name, { ...skill, isGoal: false }]))

          await save($, { ...profile, skills, updatedAt: now }, true)

          return { text: 'Goals cleared.' }
        }

        const name = normalizeSkillName(arg)

        if (name === '') {
          return { text: 'Usage: /lev goal <skill> | /lev goal clear' }
        }

        const placed = profile.skills[name] === undefined ? applyRecord(profile, { skill: name, kind: 'set', zone: 'proximal', note: 'set as a goal' }, now).profile : profile
        const skill = placed.skills[name]

        if (skill === undefined) {
          return { text: `Could not place ${name}.` }
        }

        const isGoal = !skill.isGoal
        const next: Profile = { ...placed, skills: { ...placed.skills, [name]: { ...skill, isGoal, updatedAt: now } }, updatedAt: now }

        await save($, next, true)

        return {
          text: isGoal ? `★ ${name} is a goal${profile.skills[name] === undefined ? ', placed in your zone at L2 until an attempt says otherwise' : ''}.` : `${name} is no longer a goal.`,
          context: [isGoal ? `lev: ${name} is now a goal. Prefer handing it over and mention progress on it.` : `lev: ${name} is no longer a goal.`],
        }
      }

      case 'forget': {
        const name = normalizeSkillName(rest[0] ?? '')

        if (name === '' || profile.skills[name] === undefined) {
          return { text: name === '' ? 'Usage: /lev forget <skill>' : `${name} is not in the learner model.` }
        }

        const { [name]: _dropped, ...skills } = profile.skills

        await save($, { ...profile, skills, updatedAt: now }, true)

        return { text: `${name} forgotten.`, context: [`lev: ${name} was removed from the learner model; it is unknown again.`] }
      }

      case 'pane': {
        const opened = await $.ui.open({ id: PANE, title: 'lev', focus: true })

        return { text: opened.isPlaced ? 'lev pane opened.' : 'The lev pane is open but not drawn here: it needs the fullscreen layout or a wider terminal.' }
      }

      case 'reset': {
        if (rest[0]?.toLowerCase() !== 'confirm') {
          return { text: 'This clears your whole learner model. Type /lev reset confirm to do it; /lev json first if you want a copy.' }
        }

        await save($, { ...emptyProfile(now), mode: profile.mode, sessions: 1 }, true)

        return { text: 'Learner model cleared.', context: ['lev: the learner model was reset; every skill is unknown again.'] }
      }

      default:
        return { text: HELP }
    }
  }).catch(() => ({ text: 'lev: the command failed; /lev json shows what the model holds.' }))

  // ------------------------------------------------------------------ pane

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const [profile, stats] = await Promise.all([read($, profileAtom), read($, statsAtom)])
    const columns = Math.max(24, wholeOf(e.props.bodyColumns) - 1)

    if (profile === null) {
      return <Text dimColor>Loading the learner model…</Text>
    }

    const grouped = groupSkills(profile)
    const nameWidth = Math.max(8, Math.min(26, columns - 18))
    const isEmpty = Object.keys(profile.skills).length === 0

    const rowOf = (zone: Zone, name: string, skill: Skill) => (
      <Box>
        <Text>{skill.isGoal ? '★ ' : '  '}</Text>
        <Text>{fit(name, nameWidth)}</Text>
        <Text dimColor> {zone === 'proximal' ? `${supportBar(skill.support)} ` : ''}{detailOf(skill)}</Text>
      </Box>
    )

    return (
      <Box flexDirection="column">
        <Box gap={1}>
          <Text weight="semibold">lev</Text>
          {MODES.map(mode => (
            <Button key={`mode-${mode}`} plain dimColor={profile.mode !== mode} onPress={() => void setMode($, mode)}>
              {profile.mode === mode ? `[${mode}]` : mode}
            </Button>
          ))}
        </Box>
        <Text dimColor>{`session ${profile.sessions} · ${stats.sessionEdits} edits · ${stats.sessionRecords} recorded`}</Text>
        {isEmpty && (
          <Box marginTop={1}>
            <Text dimColor>Nothing placed yet. Claude places skills as you work; /lev:assess places one now.</Text>
          </Box>
        )}
        {ZONES.map(zone =>
          grouped[zone].length === 0 ? null : (
            <Box flexDirection="column" marginTop={1}>
              <Box>
                <Text weight="semibold">{zone}</Text>
                <Text dimColor> {ZONE_LABEL[zone]}</Text>
              </Box>
              {grouped[zone].map(([name, skill]) => rowOf(zone, name, skill))}
            </Box>
          ),
        )}
        <Box marginTop={1}>
          <Text dimColor>{MODE_BLURB[profile.mode]}</Text>
        </Box>
      </Box>
    )
  })
}
