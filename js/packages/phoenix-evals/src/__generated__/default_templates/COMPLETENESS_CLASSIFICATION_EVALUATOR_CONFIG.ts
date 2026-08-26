// This file is generated. Do not edit by hand.

import type { ClassificationEvaluatorConfig } from "../types";

export const COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG: ClassificationEvaluatorConfig = {
  name: "completeness",
  description: "Assess whether the assistant addressed every distinct intention the user raised across the conversation. Enumerates every user intention, marks each addressed or unaddressed, and labels the conversation complete only when no active intention was left unanswered.",
  optimizationDirection: "MAXIMIZE",
  template: [
    {
      role: "user",
      content: `
You are an expert evaluator labeling whether an AI assistant addressed every distinct intention the user raised over the course of a conversation.

Score the assistant's coverage of user asks, not whether the user's requested outcome occurred. Completeness is about the assistant's response to each intention. External blockers — missing context, missing user input, lack of tools or permissions, safety or security policy, or the user cancelling the ask — do not make a conversation incomplete when the assistant clearly responded to that ask.

Completeness measures breadth of coverage: it asks whether each separate thing the user wanted was addressed, not whether one overarching goal was reached. A conversation can succeed at its main objective yet still be incomplete when a secondary request is silently dropped. For example, if the user asks the assistant to both reset a password and update a billing address, and the assistant handles only the reset, the conversation is incomplete even though it accomplished a real task.

An intention is a distinct request, question, or task the user wants the assistant to respond to. Identify the user's intentions from the whole conversation, then judge whether each one was addressed.

<rubric>
COMPLETE - Every active intention was addressed. The assistant responded to each distinct request, question, or task the user raised, across all turns, leaving none silently dropped or ignored. Addressing an intention does not require completing the underlying task. A conversation with no substantive request (greetings, small talk, or chit-chat only) is complete, because there is no intention left unanswered.

INCOMPLETE - At least one active intention was left unaddressed. This includes an intention that was:
- Ignored or never responded to: the user asked for something and the assistant never engaged that part.
- Only partially covered: the assistant responded to some of a multi-part request but omitted a distinct part of it with no reply. Do not treat a single question as partial merely because the assistant could not name a specific fact that the available context does not contain.
- Promised and never done: the assistant said it would do it later, or would come back to it, but never followed through and never explained a blocker.
- Falsely claimed done: the assistant said it completed a task, but the conversation or tool results show it did not. Treating a false success claim as addressing the ask is a labeling error.
- Deferred and then dropped: the user said "later", "when you finish", "don't forget", or "don't drop it", and the conversation ended without that action appearing in the assistant's output.
</rubric>

<examples>
COMPLETE (blocked on the user): User asks to file expense EX-2201. Assistant finds the receipt, says the form still needs a cost center, asks which one to use, and has not submitted. Label complete. Do not invent a user intention "provide cost center".
COMPLETE (user withdrew): User asks to cancel a plan, email finance, and report seat count, then says "Stop — do not cancel. I only need the seat count." Assistant confirms it did not cancel and reports 18 seats. Label complete. Do not keep cancellation or the finance email as unaddressed; those asks are no longer active.
INCOMPLETE (promised later): User asks to disable a deploy freeze and paste a changelog. Assistant says "I'll take care of the freeze next" and only pastes the changelog. Label incomplete: a promise is not coverage.
INCOMPLETE (constraint missing from output): User says "don't forget to cc legal@..." then asks for a draft. Assistant returns a draft with no cc and no mention of legal. Label incomplete. Do not infer that the cc happened.
</examples>

Decision test: for each active intention, ask "Does the assistant's visible reply actually cover this ask?" Covering it means answering it, refusing it, reporting missing evidence, asking the user for a legitimate blocking input, or honoring a withdrawal. Awareness, implication, or answering a different conjunct is not enough. Never mark unaddressed solely because the user did not receive the requested artifact or world-state change when the assistant did cover the ask.

Apply these rules when deciding:
1. Enumerate intentions from the entire conversation, not just the final turn. Users raise new intentions across multiple turns; a request voiced early and never returned to still counts. Consider the full record, including any tool calls and their results, when judging whether an intention was addressed.
2. List only intentions the user expressed. Do not manufacture intentions from phrasing that carries no real request. Capture the overall objective of each request, without dwelling on minor specifics. Judge whether the substance of what the user wanted was addressed, not whether every incidental detail was echoed back.
3. Keep genuinely separate requests separate. Split conjunctions ("X and Y", "then Z", a question with two clauses). Judge each independently. Answering only the first clause leaves the second unaddressed.
4. Only count the user's latest active instructions. Withdrawal is "stop / never mind / don't do that / I only need X instead." After a withdrawal, the cancelled work is no longer an open intention. Do not mark the conversation incomplete for not performing cancelled work, and do not keep the cancelled ask on the list as unaddressed.
5. A request the assistant cannot or must not fulfill is addressed once the assistant says so. If progress is blocked by capability, tools, access, knowledge, or by safety, security, privacy, or policy, a clear "I can't / I won't" with a brief reason addresses that intention. Completeness does not require the user to get the outcome they wanted.
6. Do not require a definitive answer when the provided evidence does not contain one. If the user asked a question and the assistant engages that question by stating that the given context, documents, or tool results do not specify the requested fact — optionally adding the closest relevant information that is available — the intention is addressed. 
7. Do not penalize an intention that is genuinely blocked on the user. If the assistant's last relevant action on that user task was a good-faith request for information it legitimately needs to proceed, and the user did not supply it before the conversation ended, mark the user's task addressed. 
8. Tool results and the assistant's actual output outrank the assistant's claims. If a tool returns an error, ok: false, or otherwise shows the action failed, and the assistant still says it succeeded, mark that intention unaddressed. 
9. Completeness is independent of correctness, quality, and task success. A response that engages an intention counts as addressing it even if it is wrong, verbose, poorly written, a refusal, or a report that the work cannot be done from the available evidence.

Put your complete analysis in your explanation. Work through the conversation and list every distinct user intention you identify, one line per intention, in the order they first appear, using this exact format:
INTENTIONS:
- intention: "<concise statement of what the user wanted>" | verdict: <addressed|unaddressed> | reason: "<brief justification, quoting the relevant assistant response where possible>"
If the conversation contains no substantive intention, write exactly:
INTENTIONS: none
List every user-expressed intention. Do not omit, invent, or merge distinct intentions for brevity. Use addressed when the assistant's output covers that ask, including refusals, missing-evidence answers, blocking questions to the user, and honored withdrawals. Use unaddressed when a distinct conjunct or earlier-turn request is missing from the assistant's output. The conversation is complete only if every listed intention is marked addressed (or there are none); it is incomplete if any intention is marked unaddressed.

<data>
<conversation>
{{conversation}}
</conversation>
</data>

Work through the conversation turn by turn, enumerate every distinct user intention with its verdict, and then decide. Did the assistant address every active user intention (complete) or leave at least one unaddressed (incomplete)?
`,
    },
  ],
  choices: {
  "complete": 1,
  "incomplete": 0
},
};