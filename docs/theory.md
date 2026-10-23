# The theory behind zpd

This note says what zpd takes from Vygotsky and the work that followed him, what it leaves out, and where it simplifies. It is written for someone who wants to judge whether the mechanics are faithful, not as an introduction to the field.

## 1. The zone

Vygotsky defined the zone of proximal development as "the distance between the actual developmental level as determined by independent problem solving and the level of potential development as determined through problem solving under adult guidance or in collaboration with more capable peers" (Vygotsky 1978, *Mind in Society*, p. 86). Two things in that sentence matter for a harness.

First, the zone is defined by *two measurements*, unaided and aided, not one. A test of what someone can do alone describes the lower edge. The upper edge is only visible when you give help and watch what it makes possible. zpd therefore keeps both: the `zone` is the band, and `support` is the amount of help that currently reaches the upper edge. `/zpd:assess` is built on the same idea: add help one level at a time and record the first level at which the person succeeds.

Second, "under guidance" is doing real work. Vygotsky's claim is that learning *leads* development: functions that are maturing, not yet mature, are the ones that instruction can move. Work below the zone is practice of what is already mature; work above it cannot be assisted into existence. So the three bands are the right unit, and they have different instructions attached:

| Band | zpd zone | Claude's move |
|---|---|---|
| Can do alone | `independent` | Hand it over. Doing it for them is not harmful, but it is wasted: nothing matures. |
| Can do with help | `proximal` | Scaffold at the current support level, then let them do it. This is where the harness earns its keep. |
| Cannot do even with help | `beyond` | Do it, narrate, name the concept. Vygotsky's "imitation" has a precondition: one can only imitate what is within reach. Demonstration here builds the vocabulary that will later make the skill reachable; a quiz would be cruel. |

Chaiklin (2003) is the standard corrective to loose readings: the ZPD is not "any task someone can do with help", and it is not a property of a task. It is a property of the *person's maturing functions* relative to a kind of task. zpd honours that by keying the model on skills, not on files or tickets, and by insisting that skill names denote things a person can get better at.

## 2. The more knowledgeable other

Vygotsky's "adult or more capable peer" is usually shortened to the more knowledgeable other (MKO). The MKO is not a lecturer. The MKO's job is to make the person's next step possible and then to withdraw. An AI that can do the whole task is the most knowledgeable other imaginable, and the most tempted to do it all. The protocol in the system prompt is the MKO's job description, mode by mode. The tools give the MKO memory of the person across sessions, which a human colleague has by default and a model does not.

## 3. Scaffolding and the contingent shift

"Scaffolding" is not Vygotsky's word. Wood, Bruner and Ross (1976) coined it while studying how tutors helped young children build a pyramid of blocks, and listed six things the tutor did: recruitment, reduction in degrees of freedom, direction maintenance, marking critical features, frustration control, and demonstration. The `scaffolding` skill turns each into a move Claude can make in a coding session.

The finding that makes scaffolding operational is Wood and Middleton's (1975): the tutors whose children later succeeded alone were the ones who followed a *contingent shift rule*. After the child failed, they gave more help on the next intervention; after the child succeeded, less. Not more help every time (that would be doing it for them) and not a fixed amount (that ignores the child). The shift was one step on a ladder of five levels of control, from a general verbal prompt to showing the child what to do. zpd's five support levels and its ±1 rule are a direct transcription. "Never two at once" is the part most often violated by a helpful model: a hint followed by a skeleton "just in case" is two levels, and it teaches the person to wait for the skeleton.

## 4. Fading and the apprenticeship frame

Collins, Brown and Newman (1989) placed scaffolding inside a sequence they called cognitive apprenticeship: modelling, coaching, scaffolding, fading, articulation, reflection. zpd maps onto it directly.

- Modelling: level 4, and the `beyond` zone.
- Coaching: levels 1 to 3.
- Scaffolding and fading: the contingent shift, and the rule that two successes at level 1 or below move a skill to `independent`, after which Claude hands over.
- Articulation: `/zpd:explain`, the teach-back; and the one check question that ends a learn-mode turn.
- Reflection: `/zpd:review`.

Fading is the step that cognitive-offloading critics say AI assistants skip. Bainbridge's "Ironies of Automation" (1983) made the point for industrial control: the more capable the automation, the less practised the operator, and the operator is still needed for the cases the automation cannot handle. Sparrow, Liu and Wegner (2011) showed the memory version: people remember *where* to find information rather than the information itself when they expect it to remain available. A coding assistant without fading produces an operator who can direct the assistant but cannot check it. zpd's `exposures` counter and the "missed handover" line in `/zpd:review` are there to make that debt visible.

## 5. Internalization and the social plane

Vygotsky's general genetic law: every function appears twice, first between people (interpsychological), then inside the person (intrapsychological). Speech is the central case, and the mechanism is that external, social speech becomes private speech and then inner speech. Two consequences for the harness.

First, explanation by the more knowledgeable other is not yet learning; it is the social half. The person's own reformulation is the move toward the intrapsychological plane. That is why `/zpd:explain` asks for what, why and what would break, in their words, and why the learn-mode turn ends with a question rather than a summary.

Second, shared signs matter. The skill names in the model are a small shared vocabulary: when Claude says "this touches `sql-window-functions`, which is in your zone", it is naming a function the person is in the process of internalizing. Vygotsky would call the name a tool of thought. zpd keeps the names stable across sessions and asks Claude to reuse them.

## 6. Dynamic assessment

Vygotsky argued that a static test of unaided performance measures yesterday's development and says nothing about tomorrow's. Two children with the same test score might have very different zones. Dynamic assessment, developed later by Feuerstein and others, keeps the test but adds graduated help and measures how much was needed. `/zpd:assess` is a dynamic assessment in miniature: one anchored task, help added one level at a time, the first successful level recorded. It is deliberately short, because the harness also learns from ordinary work: every recorded success and struggle is a data point of the same kind.

## 7. What zpd simplifies, and what it does not claim

- **Skills are flat.** Vygotsky's zone is about maturing functions, which interact and build on one another. zpd keeps one entry per named skill with no structure between entries. A dependency graph (you cannot be proximal in `react-hooks` while `javascript-closures` is beyond) would be truer and is a natural next step.
- **Evidence is coarse.** Success and struggle are judged by Claude on results. A generous judge inflates the model; an unlucky attempt deflates it. The ±1 rule limits the damage of any one judgment, and `/zpd set` is the correction.
- **The ladder is fixed.** Wood and Middleton's levels were specific to their task. Five levels from hand-over to demonstration are a reasonable default for coding work, not a law.
- **It measures help, not learning.** The claim is Vygotsky's: the amount of help needed to succeed is the best available proxy for where development stands. Whether a skill marked `independent` stays independent is tested by the next struggle, which brings it back into the zone.
- **Motivation is assumed.** The ZPD describes what instruction can reach, not what the person wants. Modes exist because sometimes you just need the thing done; ship mode is not a failure of the theory, it is a choice outside its scope. The review command is how the debt is paid later.

## References

- Vygotsky, L. S. (1978). *Mind in Society: The Development of Higher Psychological Processes.* Harvard University Press.
- Vygotsky, L. S. (1986). *Thought and Language.* MIT Press.
- Wood, D., Bruner, J. S. and Ross, G. (1976). The role of tutoring in problem solving. *Journal of Child Psychology and Psychiatry*, 17(2), 89–100.
- Wood, D. and Middleton, D. (1975). A study of assisted problem-solving. *British Journal of Psychology*, 66(2), 181–191.
- Collins, A., Brown, J. S. and Newman, S. E. (1989). Cognitive apprenticeship: Teaching the crafts of reading, writing, and mathematics. In L. B. Resnick (ed.), *Knowing, Learning, and Instruction*. Erlbaum.
- Chaiklin, S. (2003). The zone of proximal development in Vygotsky's analysis of learning and instruction. In A. Kozulin et al. (eds), *Vygotsky's Educational Theory in Cultural Context*. Cambridge University Press.
- Bainbridge, L. (1983). Ironies of automation. *Automatica*, 19(6), 775–779.
- Sparrow, B., Liu, J. and Wegner, D. M. (2011). Google effects on memory. *Science*, 333(6043), 776–778.
