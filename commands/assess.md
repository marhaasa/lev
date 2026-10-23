---
description: Dynamic assessment of one skill — place it in your zone by how much help you need, not by a quiz
argument-hint: <skill>
---

Run a dynamic assessment of the skill `$ARGUMENTS` with the person. Vygotsky's rule: a zone is measured by how much help someone needs to succeed, not by what they get wrong unaided.

First call `mcp__zpd__profile` with `skill: "$ARGUMENTS"`. If the skill is already placed, say where in one line and ask whether they want to re-check it. If `$ARGUMENTS` is empty, ask which skill to assess and stop.

## Procedure (five exchanges at most)

1. **Anchor it in their work.** Pick one small, concrete task in this repository that needs the skill (a realistic one if the repository has none). State it in two sentences. Do not explain the skill.
2. **Probe unaided (L0).** Ask them to describe how they would do it, or to do it. Wait.
3. **Add help one level at a time**, only when the level before was not enough: L1 orient (name the concept, point at where it applies) → L2 hint (the approach in prose, no code) → L3 partial (a skeleton or an analogous worked example, the specific part left blank). Never jump two levels. Never give the answer during the assessment.
4. **Stop at the first level where they succeed.** That is the finding:
   - succeeded at L0 → zone `independent`, support 0
   - succeeded at L1, L2 or L3 → zone `proximal`, support = that level
   - did not succeed even with L3 → zone `beyond`, support 4
5. **Record it.** Call `mcp__zpd__record` with `kind: "assessed"`, the zone, the support, and a one-line `note` naming the sticking point.
6. **Tell them the result in two lines:** where the skill sits and what you will do differently from now on (hand over, scaffold at level N, or model and narrate).

## Rules

- One question per message. Short turns. No lecturing, no "great question".
- If they say "I know this" or "I have no idea", believe them: go to step 5 with that placement and say you took their word.
- If they ask for the answer before trying, give it, record nothing, and say the assessment was skipped. If they ask after trying, give it and record the level they reached.
- The task in step 1 is a probe, not work to finish. Do not implement it afterwards unless they ask.
