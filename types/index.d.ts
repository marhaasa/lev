/**
 * The lev plugin's state contract.
 *
 * The learner model lives in `$.store` (across sessions) and is mirrored into
 * `$.state` so the pane redraws when it changes; the session's counters live
 * in `$.state` alone.
 */

/** Where a skill sits for this person: Vygotsky's three bands. */
export type Zone = 'independent' | 'proximal' | 'beyond'

/** How hard the harness leans on learning this session. */
export type Mode = 'learn' | 'balanced' | 'ship'

/**
 * One observation about a skill.
 *
 * `success` / `struggle`: the person attempted a step at the current support.
 * `explained`: a teach-back passed. `exposed`: Claude did it fully in front of
 * them. `assessed`: a dynamic assessment placed it. `set`: the person placed it.
 */
export type EvidenceKind = 'success' | 'struggle' | 'explained' | 'exposed' | 'assessed' | 'set'

export type Evidence = {
  /** ISO timestamp. */
  at: string
  kind: EvidenceKind
  /** The zone after this evidence was applied. */
  zone: Zone
  /** The support level after this evidence was applied, 0 to 4. */
  support: number
  note?: string
}

export type Skill = {
  zone: Zone
  /** How much help the next attempt gets: 0 hand over, 1 orient, 2 hint, 3 partial, 4 model. */
  support: number
  /** Consecutive successes or passed teach-backs. */
  streak: number
  /** Times Claude did it fully in front of the person. */
  exposures: number
  /** A skill the person wants to move toward independence. */
  isGoal: boolean
  createdAt: string
  updatedAt: string
  /** Most recent last, capped. */
  evidence: Evidence[]
}

export type Profile = {
  version: 1
  mode: Mode
  skills: Record<string, Skill>
  /** Sessions this profile has seen. */
  sessions: number
  updatedAt: string
}

export type SessionStats = {
  /** Main-loop turns so far. */
  turns: number
  /** File-changing tool calls this turn and this session. */
  turnEdits: number
  sessionEdits: number
  /** Calls of the record tool this turn and this session. */
  turnRecords: number
  sessionRecords: number
  /** The turn the last nudge was shown on; null before the first. */
  lastNudgeTurn: number | null
}

declare module 'claude-code' {
  interface PluginState {
    lev: {
      profile: Profile | null
      stats: SessionStats
    }
  }
}
