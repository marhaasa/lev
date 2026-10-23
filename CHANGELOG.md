# Changelog

## 0.1.0 — 2026-10-22

First release.

- A learner model kept across sessions: skills in three zones (independent, proximal, beyond), a five-level support ladder, evidence with the contingent shift (one level less help after a success, one more after a struggle), fading to independent, and entry into the zone after repeated demonstrations.
- The ZPD section of the system prompt: the protocol for Claude as the more knowledgeable other, with a snapshot of the model, per mode (learn, balanced, ship).
- Two tools the model calls: `mcp__lev__profile` and `mcp__lev__record`.
- `/lev` for the map, mode, goals and placements; `/lev:assess`, `/lev:explain`, `/lev:handover` and `/lev:review` for the model-driven moves.
- A learning-map pane with mode buttons, a status line, a learn-mode stop check and rate-limited nudges.
- A `scaffolding` skill with the craft: the six scaffolding functions as moves, the ladder worked on one skill, check questions, anti-patterns.
