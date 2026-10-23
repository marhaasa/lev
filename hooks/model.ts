/**
 * The learner model: pure functions over the Profile, no `$` in here.
 *
 * This is the portable core. Vygotsky's three bands are the `Zone`; the
 * support ladder is Wood, Bruner and Ross's scaffolding made discrete; the
 * `applyRecord` rules are Wood and Middleton's contingent shift: one level
 * less help after a success, one more after a struggle, never two.
 */
import type { Evidence, EvidenceKind, Mode, Profile, SessionStats, Skill, Zone } from '../types'

export const ZONES = ['independent', 'proximal', 'beyond'] as const
export const MODES = ['learn', 'balanced', 'ship'] as const
export const KINDS = ['success', 'struggle', 'explained', 'exposed', 'assessed', 'set'] as const

export const MAX_SUPPORT = 4
/** Evidence rows kept per skill. */
export const EVIDENCE_KEPT = 24
/** Narrated demonstrations before a `beyond` skill counts as reachable with help. */
export const EXPOSURES_TO_ENTER = 3
/** Successes in a row at low support before a `proximal` skill counts as independent. */
export const STREAK_TO_LEAVE = 2
/** Turns between two nudges. */
export const NUDGE_EVERY_TURNS = 3
/** Characters a skill name may have. */
export const NAME_MAX = 48
/** Characters a note may have. */
export const NOTE_MAX = 200

export type SupportLevel = { level: number; name: string; move: string }

/** The support ladder: what Claude does at each level, from no help to a full demonstration. */
export const SUPPORT: readonly SupportLevel[] = [
  { level: 0, name: 'hand over', move: 'state the step and its acceptance criterion; they do all of it' },
  { level: 1, name: 'orient', move: 'name the concept and point at where it applies; they do it' },
  { level: 2, name: 'hint', move: 'describe the approach in prose, no code; they implement it' },
  { level: 3, name: 'partial', move: 'give a skeleton, or a worked example of an analogous case; they finish the specific part' },
  { level: 4, name: 'model', move: 'do it in front of them, narrate the why in two or three sentences, then ask one prediction question' },
]

export const ZONE_MOVE: Record<Zone, string> = {
  independent: 'hand it over: state the step and the acceptance criterion, then wait',
  proximal: 'scaffold at the support level, then let them do it',
  beyond: 'do it fully, narrate the why, name the concept; no quiz',
}

export const ZONE_LABEL: Record<Zone, string> = {
  independent: 'you do it, Claude hands over',
  proximal: 'your zone, Claude scaffolds',
  beyond: 'Claude does it and narrates',
}

export const MODE_BLURB: Record<Mode, string> = {
  learn: 'Claude hands over what you can do, scaffolds what is in your zone, and ends such turns with one check question.',
  balanced: 'Claude does the work, narrates the why for skills in your zone, and offers small handovers when they are cheap.',
  ship: 'Claude just does the work. Run /zpd:review before you leave to turn the session into learning.',
}

export const isZone = (x: unknown): x is Zone => typeof x === 'string' && (ZONES as readonly string[]).includes(x)
export const isMode = (x: unknown): x is Mode => typeof x === 'string' && (MODES as readonly string[]).includes(x)
export const isKind = (x: unknown): x is EvidenceKind => typeof x === 'string' && (KINDS as readonly string[]).includes(x)

const wholeOf = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0)

export const clampSupport = (n: number): number => Math.min(MAX_SUPPORT, Math.max(0, Math.round(n)))

export const defaultSupportOf = (zone: Zone): number => (zone === 'independent' ? 0 : zone === 'proximal' ? 2 : MAX_SUPPORT)

export const supportNameOf = (level: number): string => SUPPORT[clampSupport(level)]?.name ?? 'hint'

export const supportMoveOf = (level: number): string => SUPPORT[clampSupport(level)]?.move ?? ''

/** `git rebase` → `git-rebase`; keeps `c#`, `c++`, `.net`; never empty for a word, never over NAME_MAX. */
export function normalizeSkillName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_/]+/g, '-')
    .replace(/[^a-z0-9.+#-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, NAME_MAX)
}

export function emptyProfile(now: string): Profile {
  return { version: 1, mode: 'balanced', skills: {}, sessions: 0, updatedAt: now }
}

export function emptyStats(): SessionStats {
  return { turns: 0, turnEdits: 0, sessionEdits: 0, turnRecords: 0, sessionRecords: 0, lastNudgeTurn: null }
}

function isEvidence(x: unknown): x is Evidence {
  if (typeof x !== 'object' || x === null) {
    return false
  }

  const e = x as Record<string, unknown>

  return typeof e.at === 'string' && isKind(e.kind) && isZone(e.zone) && typeof e.support === 'number'
}

function coerceSkill(value: unknown, now: string): Skill | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const v = value as Record<string, unknown>

  if (!isZone(v.zone)) {
    return null
  }

  const zone = v.zone
  const evidence = Array.isArray(v.evidence) ? v.evidence.filter(isEvidence).slice(-EVIDENCE_KEPT) : []

  return {
    zone,
    support: typeof v.support === 'number' && Number.isFinite(v.support) ? clampSupport(v.support) : defaultSupportOf(zone),
    streak: wholeOf(v.streak),
    exposures: wholeOf(v.exposures),
    isGoal: v.isGoal === true,
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : now,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : now,
    evidence,
  }
}

/** Reads a stored value back into a Profile, dropping what does not fit. Never throws. */
export function coerceProfile(raw: unknown, now: string): Profile {
  const empty = emptyProfile(now)

  if (typeof raw !== 'object' || raw === null) {
    return empty
  }

  const r = raw as Record<string, unknown>
  const rawSkills = typeof r.skills === 'object' && r.skills !== null ? (r.skills as Record<string, unknown>) : {}
  const skills: Record<string, Skill> = {}

  for (const [name, value] of Object.entries(rawSkills)) {
    const key = normalizeSkillName(name)
    const skill = coerceSkill(value, now)

    if (key !== '' && skill !== null) {
      skills[key] = skill
    }
  }

  return {
    version: 1,
    mode: isMode(r.mode) ? r.mode : empty.mode,
    skills,
    sessions: wholeOf(r.sessions),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  }
}

// ------------------------------------------------------------------ records

export type RecordInput = {
  skill: string
  kind: EvidenceKind
  zone?: Zone
  support?: number
  note?: string
}

export type Parsed<T> = { ok: true; input: T } | { ok: false; reason: string }

/** Validates what the model (or a command) hands the record tool. */
export function parseRecordInput(args: Readonly<Record<string, unknown>>): Parsed<RecordInput> {
  const skill = typeof args.skill === 'string' ? normalizeSkillName(args.skill) : ''

  if (skill === '') {
    return { ok: false, reason: 'skill must be a short kebab-case name such as git-rebase' }
  }

  if (!isKind(args.kind)) {
    return { ok: false, reason: `kind must be one of ${KINDS.join(', ')}` }
  }

  const kind = args.kind
  const input: RecordInput = { skill, kind }

  if (args.zone !== undefined) {
    if (!isZone(args.zone)) {
      return { ok: false, reason: `zone must be one of ${ZONES.join(', ')}` }
    }

    input.zone = args.zone
  }

  if (args.support !== undefined) {
    const support = typeof args.support === 'string' ? Number(args.support) : args.support

    if (typeof support !== 'number' || !Number.isFinite(support) || support < 0 || support > MAX_SUPPORT) {
      return { ok: false, reason: `support must be a whole number from 0 to ${MAX_SUPPORT}` }
    }

    input.support = clampSupport(support)
  }

  if ((kind === 'assessed' || kind === 'set') && input.zone === undefined) {
    return { ok: false, reason: `kind ${kind} needs a zone (${ZONES.join(', ')})` }
  }

  if (typeof args.note === 'string' && args.note.trim() !== '') {
    input.note = args.note.trim().slice(0, NOTE_MAX)
  }

  return { ok: true, input }
}

export type RecordOutcome = {
  profile: Profile
  name: string
  before: Skill | null
  after: Skill
  /** What moved, for the model. */
  summary: string
}

/** The zone a skill starts in when its first evidence arrives without a placement. */
function firstZoneOf(kind: EvidenceKind): Zone {
  return kind === 'exposed' ? 'beyond' : 'proximal'
}

type Shifted = { zone: Zone; support: number; streak: number; exposures: number; change: string }

/** The contingent shift: one level per piece of evidence, zone changes at the ladder's ends. */
function shift(skill: Skill, input: RecordInput): Shifted {
  let { zone, support, streak, exposures } = skill
  let change = ''

  switch (input.kind) {
    case 'success':
    case 'explained': {
      streak += 1

      if (zone === 'beyond') {
        zone = 'proximal'
        support = Math.min(support, MAX_SUPPORT - 1)
        change = 'done with help, so it is in the zone now'
      } else if (support > 0) {
        support -= 1
        change = 'one level less help next time'
      } else {
        change = 'no help needed'
      }

      if (zone === 'proximal' && support <= 1 && streak >= STREAK_TO_LEAVE) {
        zone = 'independent'
        support = 0
        change = 'faded out: independent now, hand it over from here'
      }

      break
    }
    case 'struggle': {
      streak = 0

      if (zone === 'independent') {
        zone = 'proximal'
        support = 1
        change = 'back in the zone: orient next time'
      } else if (zone === 'proximal') {
        if (support >= MAX_SUPPORT) {
          zone = 'beyond'
          change = 'not reachable with help yet: model it and narrate, no quiz'
        } else {
          support += 1
          change = 'one level more help next time'
        }
      } else {
        support = MAX_SUPPORT
        change = 'still beyond: model it and narrate'
      }

      break
    }
    case 'exposed': {
      exposures += 1

      if (zone === 'beyond') {
        if (exposures >= EXPOSURES_TO_ENTER) {
          zone = 'proximal'
          support = MAX_SUPPORT - 1
          change = `seen it ${exposures} times: ready for partial scaffolding`
        } else {
          change = `exposure ${exposures} of ${EXPOSURES_TO_ENTER} before it enters the zone`
        }
      } else if (zone === 'proximal') {
        change = 'done for them inside their zone: hand over a step next time'
      } else {
        change = 'done for them though they can do it: hand it over next time'
      }

      break
    }
    case 'assessed':
    case 'set': {
      zone = input.zone ?? zone
      support = input.support !== undefined ? clampSupport(input.support) : defaultSupportOf(zone)
      streak = 0
      change = `placed at ${zone}`

      break
    }
  }

  return { zone, support, streak, exposures, change }
}

export function applyRecord(profile: Profile, input: RecordInput, now: string): RecordOutcome {
  const name = normalizeSkillName(input.skill)
  const before = profile.skills[name] ?? null
  const zone0 = input.zone ?? firstZoneOf(input.kind)
  const base: Skill = before ?? {
    zone: zone0,
    support: input.support !== undefined ? clampSupport(input.support) : defaultSupportOf(zone0),
    streak: 0,
    exposures: 0,
    isGoal: false,
    createdAt: now,
    updatedAt: now,
    evidence: [],
  }
  const moved = shift(base, input)
  const row: Evidence = {
    at: now,
    kind: input.kind,
    zone: moved.zone,
    support: moved.support,
    ...(input.note !== undefined && { note: input.note }),
  }
  const after: Skill = {
    ...base,
    zone: moved.zone,
    support: moved.support,
    streak: moved.streak,
    exposures: moved.exposures,
    updatedAt: now,
    evidence: [...base.evidence, row].slice(-EVIDENCE_KEPT),
  }
  const next: Profile = { ...profile, skills: { ...profile.skills, [name]: after }, updatedAt: now }

  return { profile: next, name, before, after, summary: summaryOf(name, before, after, moved.change) }
}

function placeOf(skill: Skill): string {
  return skill.zone === 'independent' ? 'independent' : `${skill.zone} L${skill.support} ${supportNameOf(skill.support)}`
}

function summaryOf(name: string, before: Skill | null, after: Skill, change: string): string {
  const from = before === null ? 'new' : placeOf(before)
  const to = placeOf(after)
  const head = from === to ? `${name}: ${to} (unchanged)` : `${name}: ${from} → ${to}`
  const next = after.zone === 'independent' ? ZONE_MOVE.independent : after.zone === 'beyond' ? ZONE_MOVE.beyond : supportMoveOf(after.support)

  return `${head}. ${capital(change)}.\nNext time: ${next}.`
}

const capital = (s: string): string => (s === '' ? s : s[0]!.toUpperCase() + s.slice(1))

// -------------------------------------------------------------- read models

export type Grouped = Record<Zone, [string, Skill][]>

/** Skills by zone: goals first, then the most recently touched. */
export function groupSkills(profile: Profile): Grouped {
  const grouped: Grouped = { independent: [], proximal: [], beyond: [] }

  for (const entry of Object.entries(profile.skills)) {
    grouped[entry[1].zone].push(entry)
  }

  for (const zone of ZONES) {
    grouped[zone].sort((a, b) => {
      if (a[1].isGoal !== b[1].isGoal) {
        return a[1].isGoal ? -1 : 1
      }

      return b[1].updatedAt.localeCompare(a[1].updatedAt) || a[0].localeCompare(b[0])
    })
  }

  return grouped
}

export const goalsOf = (profile: Profile): string[] =>
  Object.entries(profile.skills)
    .filter(([, skill]) => skill.isGoal)
    .map(([name]) => name)
    .sort()

export const countOf = (profile: Profile, zone: Zone): number => Object.values(profile.skills).filter(skill => skill.zone === zone).length

/** `▰▰▱▱`: how much help the next attempt gets. */
export const supportBar = (level: number): string => '▰'.repeat(clampSupport(level)) + '▱'.repeat(MAX_SUPPORT - clampSupport(level))

/** One cell of detail for a skill row. */
export function detailOf(skill: Skill): string {
  if (skill.zone === 'independent') {
    return skill.streak > 0 ? `streak ${skill.streak}` : 'hand over'
  }

  if (skill.zone === 'beyond') {
    return `exposed ${Math.min(skill.exposures, EXPOSURES_TO_ENTER)}/${EXPOSURES_TO_ENTER}`
  }

  return `L${skill.support} ${supportNameOf(skill.support)}`
}

const pad = (s: string, width: number): string => (s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length))

/** The status line under the prompt. */
export function statusLineOf(profile: Profile, stats: SessionStats): string {
  const inZone = countOf(profile, 'proximal')
  const work = stats.sessionEdits > 0 ? ` · ${stats.sessionEdits} edits, ${stats.sessionRecords} recorded` : ''

  return `zpd · ${profile.mode} · ${inZone} in zone${work}`
}

/** `/zpd status`: the map as text. */
export function statusTextOf(profile: Profile, stats: SessionStats, width: number): string {
  const grouped = groupSkills(profile)
  const nameWidth = Math.max(10, Math.min(28, width - 30))
  const lines: string[] = []

  lines.push(`ZPD · mode ${profile.mode} · session ${profile.sessions} · ${stats.sessionEdits} edits, ${stats.sessionRecords} recorded this session`)
  lines.push(MODE_BLURB[profile.mode])
  lines.push('')

  if (Object.keys(profile.skills).length === 0) {
    lines.push('No skills placed yet. Claude places them as you work, or run /zpd:assess <skill> to place one now.')
  }

  for (const zone of ZONES) {
    const rows = grouped[zone]

    if (rows.length === 0) {
      continue
    }

    lines.push(`${zone} — ${ZONE_LABEL[zone]}`)

    for (const [name, skill] of rows) {
      const star = skill.isGoal ? '★' : ' '
      const bar = zone === 'proximal' ? `${supportBar(skill.support)}  ` : ''

      lines.push(`${star} ${pad(name, nameWidth)}  ${bar}${detailOf(skill)}`)
    }

    lines.push('')
  }

  const goals = goalsOf(profile)

  if (goals.length > 0) {
    lines.push(`goals: ${goals.join(', ')}`)
  }

  lines.push('/zpd help · /zpd:assess <skill> places one · /zpd:explain teaches back · /zpd:review before you leave')

  return lines.join('\n')
}

/** What the profile tool answers: the model, compact, or one skill with its recent evidence. */
export function profileTextOf(profile: Profile, skill?: string): string {
  if (skill !== undefined) {
    const found = profile.skills[skill]

    if (found === undefined) {
      return `${skill}: not in the learner model. Unknown skill: ask one short question or infer, then record assessed with your best guess and say you guessed.`
    }

    const recent = found.evidence
      .slice(-5)
      .map(row => `  ${row.at.slice(0, 10)} ${row.kind} → ${row.zone} L${row.support}${row.note ? ` (${row.note})` : ''}`)
      .join('\n')

    return [
      `${skill}: ${placeOf(found)}${found.isGoal ? ' ★goal' : ''}; streak ${found.streak}; exposures ${found.exposures}`,
      `Next time: ${found.zone === 'proximal' ? supportMoveOf(found.support) : ZONE_MOVE[found.zone]}.`,
      recent === '' ? '  (no evidence yet)' : recent,
    ].join('\n')
  }

  const grouped = groupSkills(profile)
  const lines = [`mode: ${profile.mode}`]

  for (const zone of ZONES) {
    const rows = grouped[zone]

    if (rows.length === 0) {
      continue
    }

    const cells = rows.map(([name, s]) => (zone === 'proximal' ? `${name} L${s.support} ${supportNameOf(s.support)}` : zone === 'beyond' ? `${name} (exposed ${s.exposures})` : name) + (s.isGoal ? ' ★' : ''))

    lines.push(`${zone} (${ZONE_MOVE[zone]}): ${cells.join(' · ')}`)
  }

  if (lines.length === 1) {
    lines.push('no skills placed yet')
  }

  const goals = goalsOf(profile)

  if (goals.length > 0) {
    lines.push(`goals (prefer handing these over): ${goals.join(', ')}`)
  }

  return lines.join('\n')
}

export function nudgeTextOf(stats: SessionStats): string {
  const edits = `${stats.turnEdits} edit${stats.turnEdits === 1 ? '' : 's'}`

  return `zpd: ${edits} this turn, nothing recorded in your learner model · /zpd:explain to teach it back · /zpd:review before you leave`
}

/** Splits a command's arguments on whitespace, honouring double quotes. */
export function parseArgs(args: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|(\S+)/g
  let match: RegExpExecArray | null = re.exec(args)

  while (match !== null) {
    out.push(match[1] ?? match[2] ?? '')
    match = re.exec(args)
  }

  return out
}
