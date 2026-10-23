# zpd

**Keep learning while Claude does the work.** A Claude Code plugin built on Lev Vygotsky's Zone of Proximal Development.

When an AI does the work, the human stops learning. Not because the AI hides anything, but because learning happens in a narrow band: the things you cannot yet do alone but can do with help. Work below that band is routine; work above it is noise; an AI that quietly does everything in the band takes away the only part worth keeping. Vygotsky named that band the zone of proximal development (ZPD) and described the role of the *more knowledgeable other*: someone who gives exactly as much help as you need, then less as you grow.

zpd makes Claude Code that other. It keeps a learner model of you across sessions, puts the protocol for working in your zone into Claude's system prompt, gives Claude tools to read and update the model as you work together, and adds a few commands for the moves that need a person in the loop: placing a skill, teaching it back, handing work over, reviewing a session.

## What it looks like

```
> add a window function for the 30-day rolling average

This touches sql-window-functions (in your zone, L2) and dbt-models (independent).

For the window function, the approach: a SUM over a frame of the preceding 29 rows plus the
current one, partitioned by customer and ordered by day; divide by the row count of that same
frame so the first weeks average over what exists. No code from me at this level.

The dbt model wrapper is yours: add models/marts/rolling_sales.sql with the ref() to
stg_sales; done when `dbt run -s rolling_sales` passes.

One question before you start: what will the first row's average be, and why?
```

Behind that answer: the learner model said `sql-window-functions` was proximal at support level 2 (hint: approach in prose, no code) and `dbt-models` was independent (hand it over). When you report back, Claude records a success or a struggle and the help moves one level.

## Install

At the prompt of a terminal session:

```
/plugin install zpd --marketplace marhaasa/zpd
```

Answer `y` to add the marketplace, then pick a scope (user is the usual one). From a shell, `claude plugin install zpd --marketplace marhaasa/zpd`. In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `marhaasa/zpd`, then Add plugin.

To run it from a clone while developing: `claude --plugin-dir /path/to/zpd`.

Requires Claude Code 2.1.308 or later: the hooks module uses the function-hooks API (early access), and the engine lays its type declarations beside the plugin when it loads it.

## How it works

### The learner model

One entry per skill. Skills are named in lowercase-kebab-case (`git-rebase`, `react-hooks`, `sql-window-functions`): things a person can get better at, not files or tickets. Each entry has:

| Field | Meaning |
|---|---|
| `zone` | `independent` (you can do it alone), `proximal` (you can do it with help), `beyond` (not reachable yet, even with help) |
| `support` | How much help the next attempt gets, 0 to 4; see the ladder |
| `streak` | Successes in a row |
| `exposures` | Times Claude did it fully in front of you |
| `isGoal` | A skill you want to move toward independence |
| `evidence` | The last 24 observations, each with a kind, the resulting zone and level, and a note |

The model is stored in the plugin's own key-value store under your Claude Code configuration directory. It is yours, not the project's: skills travel with you across repositories. `/zpd json` prints it.

### The support ladder

Wood, Bruner and Ross described scaffolding as a set of things a tutor does; Wood and Middleton found that what distinguished effective tutors was *contingency*: more help after a failure, less after a success, one step at a time. zpd makes that discrete:

| Level | Name | What Claude does |
|---|---|---|
| 0 | hand over | states the step and its acceptance criterion; you do all of it |
| 1 | orient | names the concept and points at where it applies; you do it |
| 2 | hint | describes the approach in prose, no code; you implement it |
| 3 | partial | gives a skeleton, or a worked example of an analogous case; you finish the specific part |
| 4 | model | does it in front of you, narrates the why, then asks one prediction question |

After a success the level drops by one; after a struggle it rises by one; never two at once. Two successes at level 1 or below fade the skill to `independent`. A struggle at level 4 moves it to `beyond`. Three narrated demonstrations bring a `beyond` skill into the zone at level 3. The rules live in `hooks/model.ts` and are tested in `tests/model.test.ts`.

### Modes

| Mode | What changes |
|---|---|
| `learn` | Claude hands over what you can do, scaffolds what is in your zone, demonstrates what is beyond, and ends a turn that touched your zone with one check question. A turn that changed files is held once until Claude has recorded what it did. |
| `balanced` (default) | Claude does the work, narrates the why for skills in your zone, offers a small handover when it is cheap, and records what it did. No check questions unless you ask. |
| `ship` | Claude just does the work. No scaffolding, no questions, no recording. `/zpd:review` at the end turns the session into learning. |

Switch with `/zpd mode learn`, or the buttons in the pane. The mode is part of the model, so it persists.

### Where the pieces live

- **System prompt.** A `prompt.compose` hook appends a section with the protocol, a snapshot of the model, and the rules for the current mode. The snapshot refreshes at session start and on `/zpd` commands, never on a tool call, so the prompt cache holds through a turn.
- **Tools.** `mcp__zpd__profile` reads the live model; `mcp__zpd__record` writes one piece of evidence and answers with the new level to use next time.
- **Stop check.** In learn mode, a `classic.Stop` hook holds a turn that changed files, once, until the model has an entry for it. Turn it off with the `enforce` option.
- **Nudges.** In learn and balanced mode, a dim line beneath an answer when Claude changed files in your zone and recorded nothing, at most every three turns. Turn it off with `nudges`.
- **Pane.** A learning map beside the transcript: skills by zone with their level, goals starred, mode buttons. It opens by itself in the fullscreen layout on a wide terminal; `/zpd pane` opens it anywhere.
- **Status line.** `zpd · learn · 3 in zone · 12 edits, 4 recorded`.

## Commands

| Command | What it does |
|---|---|
| `/zpd` | The map: zones, levels, goals, this session's counts |
| `/zpd mode learn\|balanced\|ship` | Switch mode |
| `/zpd set <skill> <zone> [0-4]` | Place a skill yourself |
| `/zpd goal <skill>` | Toggle a goal; Claude then prefers handing it over. `/zpd goal clear` |
| `/zpd forget <skill>` | Remove a skill |
| `/zpd pane` | Open the learning map |
| `/zpd json` | The raw model |
| `/zpd reset confirm` | Start over |
| `/zpd:assess <skill>` | **Dynamic assessment.** Claude anchors a small task in your repo, probes unaided, then adds help one level at a time; the first level at which you succeed is the placement. Five exchanges at most. |
| `/zpd:explain [skill]` | **Teach-back.** You explain the last piece of work in your own words: what, why, what would break. Claude judges the content, corrects one misconception at most, records the result. |
| `/zpd:handover [step]` | **Handover.** Claude plans, does the `beyond` steps, picks the first step in your zone, scaffolds it at your level, states the acceptance criterion, and waits. |
| `/zpd:review` | **Session review.** What Claude did for you, what you did, missed handovers in your zone, what moved, and one or two skills to make goals. How ship mode pays its learning debt. |

The `scaffolding` skill holds the craft behind these: the six scaffolding functions as moves, the ladder worked on one skill, how to write a check question, the anti-patterns. Claude loads it when it is about to scaffold in learn mode or when a handover is not landing.

## Configuration

Shown in `/config` under the plugin's name:

| Option | Default | Meaning |
|---|---|---|
| `pane` | `auto` | `auto` opens the pane in a fullscreen layout on a wide terminal; `command` only on `/zpd pane`; `off` never |
| `enforce` | `true` | The learn-mode stop check |
| `nudges` | `true` | The dim line beneath an answer for unrecorded work |

## Theory to mechanics

| Vygotsky (and those who built on him) | zpd |
|---|---|
| The three bands: what one can do alone, with help, not at all | `zone`: `independent`, `proximal`, `beyond` |
| The more knowledgeable other | Claude, under the protocol in the system prompt |
| Scaffolding (Wood, Bruner, Ross 1976) | the five support levels; the six functions as moves in the `scaffolding` skill |
| Contingent shift (Wood, Middleton 1975) | one level less after a success, one more after a struggle, never two |
| Fading (Collins, Brown, Newman 1989) | two successes at low support move a skill to `independent`; Claude then hands over |
| Internalization: from the social plane to one's own | `/zpd:explain`, and the one check question that ends a learn-mode turn |
| Dynamic assessment: measure the zone by the help needed | `/zpd:assess` |
| Mediation through signs; shared language | skill names as a vocabulary you and Claude both use |
| "What a child can do with assistance today she will be able to do by herself tomorrow" | goals: `proximal` skills Claude prefers to hand over |

`docs/theory.md` goes deeper, including what the theory does not say and where zpd simplifies it.

## Costs and caveats

- The system prompt section is about 600 tokens in learn and balanced mode, 80 in ship mode. It sits after the prompt cache boundary and changes only at session start and on `/zpd` commands.
- Each record is one short tool call. In learn mode expect one or two per turn that does work; in balanced mode fewer; in ship mode none.
- The model is only as good as the evidence. Claude judges success and struggle on results (a test, an output), but a generous judge inflates the model. `/zpd:assess` and `/zpd set` are the corrections.
- The stop check is one held turn, not a loop: the second pass always goes through. If it gets in the way, `enforce: false`.
- Nothing here measures learning. It measures how much help was needed, which is what Vygotsky proposed as the thing to measure.

## Portability

The protocol (`hooks/protocol.ts`) and the model (`hooks/model.ts`, `types/index.d.ts`) do not touch the Claude Code API. Another harness can reuse them by giving its model two tools with the same contract, a system-prompt section from `protocolOf`, and a JSON store for the profile.

## Development

```
claude plugin validate .      # the manifest, the hooks module, what it hooks and calls
claude plugin test .          # tests/*.test.ts against the engine's own test kit
claude --plugin-dir .         # run a session with the plugin loaded from this folder
```

Type-check with `tsc -p .` after the engine has laid `.claude-plugin/types/` (it does so the first time it loads the plugin from this folder). The engine's declaration file is the authority on the API; `claude plugin validate` reports anything it would refuse.

## License

MIT.
