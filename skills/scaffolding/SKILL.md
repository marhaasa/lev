---
name: scaffolding
description: How to scaffold a step inside someone's zone of proximal development - the five support levels as concrete moves with a worked example, how to write a check question, the contingent-shift rule, and the anti-patterns. Load before scaffolding a proximal skill in learn mode, when a handover is not landing, or when the person says the help is too much or too little.
---

# Scaffolding a step

The zpd plugin's system-prompt section says *what* to do at each support level. This skill is the *how*. It draws on Wood, Bruner and Ross (1976), who named six things a tutor does, and on Wood and Middleton (1975), who showed that the tutors whose learners improved most were the ones who adjusted help contingently: more after a failure, less after a success, one step at a time.

## The six functions, as moves you can make

| Function | The move in a coding session |
|---|---|
| Recruitment | Tie the step to something they want: the failing test, the feature they asked for. One sentence. |
| Reduction in degrees of freedom | Shrink the step until one decision is left. "Only the WHERE clause; the rest is written." |
| Direction maintenance | When they drift, restate the goal, not the method. |
| Marking critical features | Point at the one thing that matters: "the rebase rewrites hashes; that is why the push is refused." |
| Frustration control | After a struggle, go up one level at once. Do not let them stall twice. |
| Demonstration | Do it in front of them (L4), narrating the *why*, then ask them to predict. Only when lower levels failed or the skill is beyond. |

## The ladder, worked on one skill

Skill: `git-rebase`. Task: the branch is behind `main` and the person must bring it up to date without a merge commit.

- **L0 hand over.** "Rebase this branch onto main; done when `git log --oneline -5` shows your three commits on top of main's latest." Nothing else.
- **L1 orient.** "This is a rebase, not a merge: it replays your commits on a new base. `git rebase --help` has the one flag you need." Then wait.
- **L2 hint.** "Fetch first so main is current. Then rebase onto `origin/main`. If a commit conflicts, fix the file, stage it, continue; do not commit. Push with force-with-lease because the hashes changed." No commands shown.
- **L3 partial.** Give the sequence with the specific part blank: `git fetch origin`, `git rebase ____`, resolve, `git add <file>`, `git rebase --continue`, `git push --force-with-lease`. They fill the blank and run it.
- **L4 model.** Run it yourself, narrating: "Fetching so the base is current. Rebasing onto origin/main: the three commits get new hashes. Force-with-lease because the remote still has the old ones, and lease fails safe if someone else pushed." Then: "Before I push: what will `git status` say about the branch versus origin?"

Give **one** level, not a smear of them. A hint followed by a skeleton "just in case" is two levels; it teaches them to wait for the skeleton.

## Check questions

One per turn, at the end, when the turn touched a proximal skill. The point is to pull the idea from the social plane (you said it) to theirs (they can use it). Four shapes:

- **Predict.** "What will the test print now?" Best after a demonstration.
- **Explain.** "Why `--force-with-lease` and not `--force`?" Best after a hint they acted on.
- **Modify.** "Change it so the window is 7 days instead of 30." Best for proximal skills near independent.
- **Contrast.** "What would be different if this were a merge?" Best when two concepts blur.

Keep it to one sentence. Do not answer it yourself in the same message. If they do not answer and move on, let it go; do not re-ask.

## The contingent shift

After each attempt, record it and move the level by exactly one:

- They did the step → `mcp__zpd__record` with `success` → next time one level less.
- They could not → `struggle` → next time one level more, at once, in this same turn if there is time.
- They explained it back correctly → `explained` → counts as a success.
- You did it for them → `exposed` → no change, but it counts; three exposures bring a `beyond` skill into the zone.

The tool result names the new level. Use that, not your memory.

## Anti-patterns

- **Socratic drag.** Three questions in a row with no new help. After one unanswered question, add a level.
- **The quiz voice.** "Can you tell me what a rebase is?" Ask about *their* task, never a definition.
- **Lecture before attempt.** If they have not tried, the most you give is the level's move. The explanation comes after, and only for what they got wrong.
- **Praise inflation.** "Great job" after a trivial step reads as condescension. Say what was right, specifically, or say nothing.
- **Hiding work.** In `beyond`, do not pretend a step is theirs. Do it, name it, record `exposed`.
- **Protocol over person.** "Just do it" means do it. Record `exposed` and move on.

## Unknown skills

When the task touches a skill the model has no entry for: one question, in their terms. "Have you rebased before, or mostly merged?" Record `assessed` with a zone and a support from their answer, and say you guessed. If they do not answer, assume `proximal` at L2 and adjust from the first attempt.
