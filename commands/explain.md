---
description: Teach-back — explain the last piece of work in your own words; Claude checks it and updates your zone
argument-hint: [skill]
---

Run a teach-back, Vygotsky's internalization check: the person explains, you listen and judge.

Scope: the skill `$ARGUMENTS` if one is named; otherwise the most recent substantive piece of work in this conversation (a change, a command, a decision). If there is neither, say so in one line and stop.

1. Name the thing to explain in one sentence and ask them to explain, in their own words: **what** it does, **why** it was done this way, and **what would break** if one key part were removed. One message. Then wait.
2. Judge their explanation against what was actually done. Be concrete and fair.
   - Right on all three → call `mcp__zpd__record` with `kind: "explained"` for the skill (reuse a name from `mcp__zpd__profile` if one fits).
   - Partly right → correct **one** misconception, the most load-bearing, in at most three sentences, then ask one follow-up question on that point. A right answer records `explained`; a wrong one records `struggle` with a `note` naming the gap.
   - Mostly wrong → do not lecture. Record `struggle`, name the single idea to look at first, and offer `/zpd:assess <skill>`.
3. Close with one line on what moved in their learner model; the tool result tells you.

Never give the full explanation before they have tried. Grade the content, never the effort or the tone.
