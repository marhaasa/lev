import { describe, expect, test } from 'claude-code/testing'

import { applyRecord, coerceProfile, emptyProfile, groupSkills, normalizeSkillName, parseArgs, parseRecordInput } from '../hooks/model'
import type { Profile, Skill, Zone } from '../types'

const T0 = '2026-10-22T10:00:00.000Z'

const skillOf = (zone: Zone, support: number, extra: Partial<Skill> = {}): Skill => ({
  zone,
  support,
  streak: 0,
  exposures: 0,
  isGoal: false,
  createdAt: T0,
  updatedAt: T0,
  evidence: [],
  ...extra,
})

const withSkill = (zone: Zone, support: number, extra: Partial<Skill> = {}): Profile => ({
  ...emptyProfile(T0),
  skills: { 'git-rebase': skillOf(zone, support, extra) },
})

describe('skill names', () => {
  test('normalize to lowercase kebab-case and keep the characters languages are spelled with', async () => {
    expect(normalizeSkillName('  Git Rebase ')).toBe('git-rebase')
    expect(normalizeSkillName('React_Hooks!')).toBe('react-hooks')
    expect(normalizeSkillName('C#')).toBe('c#')
    expect(normalizeSkillName('sql/window functions')).toBe('sql-window-functions')
    expect(normalizeSkillName('---')).toBe('')
  })
})

describe('the contingent shift', () => {
  test('a success takes one level of help away; two at low support fade the skill to independent', async () => {
    const first = applyRecord(withSkill('proximal', 2), { skill: 'git-rebase', kind: 'success' }, T0)

    expect(first.after.zone).toBe('proximal')
    expect(first.after.support).toBe(1)
    expect(first.summary).toContain('proximal L2 hint → proximal L1 orient')

    const second = applyRecord(first.profile, { skill: 'git-rebase', kind: 'success' }, T0)

    expect(second.after.zone).toBe('independent')
    expect(second.after.support).toBe(0)
    expect(second.summary).toContain('hand it over')
  })

  test('a struggle adds one level; at the top of the ladder the skill goes beyond', async () => {
    const more = applyRecord(withSkill('proximal', 2), { skill: 'git-rebase', kind: 'struggle' }, T0)

    expect(more.after.support).toBe(3)
    expect(more.after.zone).toBe('proximal')

    const beyond = applyRecord(withSkill('proximal', 4), { skill: 'git-rebase', kind: 'struggle' }, T0)

    expect(beyond.after.zone).toBe('beyond')
    expect(beyond.summary).toContain('no quiz')
  })

  test('a struggle with an independent skill brings it back into the zone at orient', async () => {
    const back = applyRecord(withSkill('independent', 0, { streak: 5 }), { skill: 'git-rebase', kind: 'struggle' }, T0)

    expect(back.after.zone).toBe('proximal')
    expect(back.after.support).toBe(1)
    expect(back.after.streak).toBe(0)
  })

  test('three narrated demonstrations bring a beyond skill into the zone at partial support', async () => {
    let profile = withSkill('beyond', 4)

    for (let n = 1; n <= 2; n += 1) {
      const seen = applyRecord(profile, { skill: 'git-rebase', kind: 'exposed' }, T0)

      expect(seen.after.zone).toBe('beyond')
      expect(seen.after.exposures).toBe(n)
      profile = seen.profile
    }

    const third = applyRecord(profile, { skill: 'git-rebase', kind: 'exposed' }, T0)

    expect(third.after.zone).toBe('proximal')
    expect(third.after.support).toBe(3)
  })

  test('a demonstration inside the zone changes no level but is counted', async () => {
    const seen = applyRecord(withSkill('proximal', 2), { skill: 'git-rebase', kind: 'exposed' }, T0)

    expect(seen.after.support).toBe(2)
    expect(seen.after.exposures).toBe(1)
    expect(seen.summary).toContain('hand over a step next time')
  })

  test('a passed teach-back on a beyond skill counts as doing it with help', async () => {
    const told = applyRecord(withSkill('beyond', 4), { skill: 'git-rebase', kind: 'explained' }, T0)

    expect(told.after.zone).toBe('proximal')
    expect(told.after.support).toBe(3)
  })

  test('an assessment places a skill where it was found and resets the streak', async () => {
    const placed = applyRecord(withSkill('beyond', 4, { streak: 3 }), { skill: 'git-rebase', kind: 'assessed', zone: 'proximal', support: 1, note: 'forgets to fetch' }, T0)

    expect(placed.after.zone).toBe('proximal')
    expect(placed.after.support).toBe(1)
    expect(placed.after.streak).toBe(0)
    expect(placed.after.evidence.at(-1)?.note).toBe('forgets to fetch')
  })

  test('a skill without an entry starts in the zone on a success and beyond on a demonstration', async () => {
    const fresh = emptyProfile(T0)
    const did = applyRecord(fresh, { skill: 'React Hooks', kind: 'success' }, T0)

    expect(did.name).toBe('react-hooks')
    expect(did.after.zone).toBe('proximal')
    expect(did.after.support).toBe(1)
    expect(did.summary).toContain('react-hooks: new → proximal L1 orient')

    const saw = applyRecord(fresh, { skill: 'k8s-operators', kind: 'exposed' }, T0)

    expect(saw.after.zone).toBe('beyond')
    expect(saw.after.exposures).toBe(1)
  })

  test('evidence is capped and other skills are left alone', async () => {
    let profile: Profile = { ...withSkill('proximal', 2), skills: { ...withSkill('proximal', 2).skills, other: skillOf('independent', 0) } }

    for (let n = 0; n < 30; n += 1) {
      profile = applyRecord(profile, { skill: 'git-rebase', kind: n % 2 === 0 ? 'struggle' : 'success' }, T0).profile
    }

    expect(profile.skills['git-rebase']?.evidence.length).toBe(24)
    expect(profile.skills.other).toEqual(skillOf('independent', 0))
  })
})

describe('what the record tool accepts', () => {
  test('a kind outside the list, a placement without a zone, and an empty name are refused with a reason', async () => {
    expect(parseRecordInput({ skill: 'git-rebase', kind: 'nope' })).toEqual({ ok: false, reason: expect.stringContaining('kind must be one of') })
    expect(parseRecordInput({ skill: 'git-rebase', kind: 'assessed' })).toEqual({ ok: false, reason: expect.stringContaining('needs a zone') })
    expect(parseRecordInput({ skill: '  ', kind: 'success' })).toEqual({ ok: false, reason: expect.stringContaining('skill must be') })
    expect(parseRecordInput({ skill: 'git-rebase', kind: 'assessed', zone: 'proximal', support: 9 })).toEqual({ ok: false, reason: expect.stringContaining('0 to 4') })
  })

  test('a good record is normalized: the name, a numeric string for support, a trimmed note', async () => {
    expect(parseRecordInput({ skill: 'Git Rebase', kind: 'assessed', zone: 'proximal', support: '3', note: '  slow on conflicts  ' })).toEqual({
      ok: true,
      input: { skill: 'git-rebase', kind: 'assessed', zone: 'proximal', support: 3, note: 'slow on conflicts' },
    })
  })
})

describe('the store', () => {
  test('garbage coerces to an empty profile; a good one round-trips; a bad entry is dropped and a bad level clamped', async () => {
    expect(coerceProfile('garbage', T0)).toEqual(emptyProfile(T0))
    expect(coerceProfile(null, T0)).toEqual(emptyProfile(T0))

    const good = withSkill('proximal', 2, { isGoal: true })

    expect(coerceProfile(JSON.parse(JSON.stringify(good)), T0)).toEqual(good)

    const mixed = coerceProfile({ mode: 'learn', skills: { 'git-rebase': { zone: 'nowhere' }, 'React Hooks': { zone: 'proximal', support: 99 } } }, T0)

    expect(mixed.mode).toBe('learn')
    expect(Object.keys(mixed.skills)).toEqual(['react-hooks'])
    expect(mixed.skills['react-hooks']?.support).toBe(4)
  })
})

describe('reading the model', () => {
  test('skills group by zone with goals first', async () => {
    const profile: Profile = {
      ...emptyProfile(T0),
      skills: {
        a: skillOf('proximal', 2, { updatedAt: '2026-10-22T12:00:00.000Z' }),
        b: skillOf('proximal', 1, { isGoal: true, updatedAt: '2026-10-22T11:00:00.000Z' }),
        c: skillOf('independent', 0),
        d: skillOf('beyond', 4),
      },
    }
    const grouped = groupSkills(profile)

    expect(grouped.proximal.map(([name]) => name)).toEqual(['b', 'a'])
    expect(grouped.independent.map(([name]) => name)).toEqual(['c'])
    expect(grouped.beyond.map(([name]) => name)).toEqual(['d'])
  })

  test('command arguments split on whitespace and keep quoted phrases', async () => {
    expect(parseArgs('set "sql window functions" proximal 2')).toEqual(['set', 'sql window functions', 'proximal', '2'])
    expect(parseArgs('')).toEqual([])
  })
})
