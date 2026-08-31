// This file is generated. Do not edit by hand.

import type { ClassificationEvaluatorConfig } from "../types";

export const COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG: ClassificationEvaluatorConfig = {
  name: "completeness",
  description: "Assess whether every active user request in a conversation was actually completed. Enumerates every user-expressed intention, classifies each as completed, withdrawn, pending_user, blocked, failed, or ignored, and labels the conversation complete only when every non-withdrawn intention is completed.",
  optimizationDirection: "MAXIMIZE",
  template: [
    {
      role: "user",
      content: `
You are an expert evaluator labeling whether an AI assistant completed every active request the user made over the course of a conversation.

Completeness is a strict measure of finished work. It asks whether each active user request was fulfilled with a delivered answer, a delivered artifact (including every required component), or an action whose success is visible in the record. It does not ask whether completion was appropriate, possible, or polite. Acknowledgment, a clarifying question, a refusal, a promise, or a report of a blocker is not completion.

Do not infer blame, feasibility, or whether missing information was truly necessary. Classify the observable state of each request.

An intention is a distinct request, question, or task the user expressed. List every user-expressed intention, including ones later withdrawn. Withdrawn intentions stay on the list as withdrawn, but they are excluded from the completeness decision.

<rubric>
COMPLETE - Every non-withdrawn intention was completed. The assistant delivered the requested work for each active request. A conversation with no substantive request (greetings, small talk, or chit-chat only) is complete. A conversation whose only remaining intentions were explicitly withdrawn is complete.

INCOMPLETE - At least one non-withdrawn intention was not completed. That includes pending_user, blocked, failed, and ignored.
</rubric>


Per-intention states (exactly one per listed intention):
- completed: the requested work was delivered.
  - Answers: the assistant stated a value or direct answer for every part of the question in its visible reply to the user (for example a number, name, date, or yes/no). A number that appears only inside a tool payload does not complete an "tell me X" / "report X" request; the assistant must relay it. Correctness, grounding, and whether needed context was present do not matter. Saying the requested fact is absent, unknown, or not in the context is not an answer; use blocked. If the question has two asked quantities, both must be stated.
  - Artifacts: the requested artifact was produced, including every component the user required of it.
  - Actions: when tool results are in the record, they confirm success of that action. A lookup or read tool does not complete a write, pause, create-side-effect, or notify action. If tools are present and the mutating call is missing, errored, or still shows the old state, the action is failed even if the assistant claims success. When no tool record exists, use only the assistant's visible output; a bare claim of success is not enough if later output contradicts it.
- withdrawn: the user cancelled, replaced, or otherwise took this request off the table ("stop", "never mind", "don't do that", "I only need X instead"). Honor the latest active instructions.
- pending_user: the assistant's last relevant action on this request was a question or request for input, and the user did not supply it before the conversation ended. Do not judge whether that input was necessary.
- blocked: the assistant did not complete the request and reported that it cannot or must not proceed (capability, tools, access, safety, security, privacy, policy, or missing evidence). A refusal or "the context does not contain X" is blocked, not completed.
- failed: the assistant attempted the request but the visible record shows it did not succeed (tool error, ok: false, false success claim, or a delivered artifact missing a required part).
- ignored: the assistant never engaged this request, dropped it after a promise, or answered a different conjunct instead.

Conversation result:
- Exclude withdrawn intentions from the denominator.
- The conversation is complete only when every remaining intention is completed (or there are no substantive intentions).
- Otherwise the conversation is incomplete.
- Do not collapse the session into a single reason. A session may contain both a blocked request and an ignored request; report each state's reason on its own line.

Apply these rules when deciding:
1. Enumerate intentions from the entire text provided, not just the final turn. A request voiced early and never returned to still counts unless it was withdrawn. Use the full record, including tool calls and tool results, if present.
2. List only intentions the user expressed. Do not manufacture intentions from phrasing that carries no real request. Capture the overall objective of each request, without dwelling on incidental wording. Split genuinely separate requests (conjunctions, "then Z", a question with two clauses, etc.). Judge each independently. Completing the first conjunct does not complete the second.
3. List withdrawn intentions as withdrawn. Do not omit them, and do not treat cancelled work as incomplete. After a withdrawal, still check every remaining active request. Confirming "I did not do the cancelled thing" is not completion of a different remaining ask.
4. Promises, acknowledgments, and "I'll do it next" are not completion.
5. A question to the user is not completion of the original task. Use pending_user.
6. Safety refusals and reported blockers are not completion. Use blocked, even when the assistant behaved correctly.
7. Do not infer whether missing information or missing context was actually necessary. If no answer/artifact/successful action was delivered, classify the observable state (pending_user, blocked, failed, or ignored). "The context/excerpt does not contain X" is blocked, even when the assistant adds related information from the document.
8. Tool results and the assistant's actual output outrank claims. Successful tool results count as completion of that action when they confirm success. Failed, contradictory, or missing mutating tool results mean failed.
9. Completeness is independent of correctness and quality for delivered answers. A wrong or low-quality answer can still be completed only when the requested value was actually stated. That exception does not apply to tool-mediated actions, which require evidence of success, and it does not apply to artifacts or action lists that omit a required component.

Put your complete analysis in your explanation. Work through the given text and list every distinct user intention you identify, one line per intention, in the order they first appear, using this exact format:
INTENTIONS:
- intention: "<concise statement of what the user wanted>" | state: <completed|withdrawn|pending_user|blocked|failed|ignored> | reason: "<brief justification, quoting the relevant assistant or tool output where possible>"
If the conversation contains no substantive intention, write exactly:
INTENTIONS: none
List every user-expressed intention, including withdrawn ones. Do not omit, invent, or merge distinct intentions for brevity. After the list, decide complete vs incomplete from the states: ignore withdrawn; complete only if every other listed intention is completed.

<data>
<conversation>
{{conversation}}
</conversation>
</data>

Work through the given text turn by turn, classify each distinct user intention, and then decide. Did the assistant complete every active user intention (complete), or did any non-withdrawn intention remain unfinished (incomplete)?
`,
    },
  ],
  choices: {
  "complete": 1,
  "incomplete": 0
},
};