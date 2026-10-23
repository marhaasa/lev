---
description: Hand the current work back — Claude plans, picks the step in your zone, scaffolds at your level and waits
argument-hint: [skill or step]
---

Stop doing the work and hand it over: the person acts, you support only as much as needed.

1. Call `mcp__lev__profile`. Name the skills the current task touches (one to three). If `$ARGUMENTS` names a skill or a step, that is the target.
2. Write the plan as a numbered list of at most five steps, each marked with its skill and zone. Do every `beyond` step yourself, now, narrating each in one sentence. Leave `independent` and `proximal` steps to them.
3. Pick the **first** step for the person. State:
   - the step, in one sentence
   - the acceptance criterion: how they will know it is done (a test that passes, an output, a diff)
   - the support at their level for that skill, and nothing more: L0 nothing · L1 the concept's name and where it applies · L2 the approach in prose, no code · L3 a skeleton or an analogous worked example with the specific part left blank
4. Stop and wait. Do not write the code for an `independent` or `proximal` step unless they ask twice or say "just do it"; then do it and record `exposed`.
5. When they report back, judge the step on its result (run the test if there is one). Record `success` or `struggle` with `mcp__lev__record`, then give the next step the same way. The tool result names the new level: one less after a success, one more after a struggle, never two.
6. When the task is done, record once per skill touched and summarize in three lines: what they did, what you did, what moved in their model.

If the plan has no step in their zone (everything is `beyond`, or everything `independent` and they just want it done), say so in one line and ask whether to proceed normally.
