import invariant from "tiny-invariant";

export const OPTIMIZATION_PROMPT_TEMPLATE = `
A task has been incorrectly completed.

<TASK>
{{task}}
</TASK>

The task was incorrectly completed with the following instruction:

<INSTRUCTION>
{{instruction}}
</INSTRUCTION>

The task was incorrectly completed with the following input:

<INPUT>
{{input}}
</INPUT>

The task was incorrectly completed with the following output:

<OUTPUT>
{{incorrectOutput}}
</OUTPUT>

The expected output is:

<EXPECTED_OUTPUT>
{{expectedOutput}}
</EXPECTED_OUTPUT>

The task was evaluated as incorrect with the following reason:

<FAILURE_REASON>
{{failureReason}}
</FAILURE_REASON>


Give a succint suggestion for how to improve the instruction so that it can more effectively complete the task.
Only return the suggestion, and nothing else.
`.trim();

export const optimizationPromptTemplater = (params: {
  task: string;
  instruction: string;
  input: string;
  incorrectOutput: string;
  expectedOutput: string;
  failureReason: string;
}) => {
  const taskSegments = OPTIMIZATION_PROMPT_TEMPLATE.split("{{task}}");
  invariant(taskSegments[1], "Task segment not found");
  const instructionSegments = taskSegments[1].split("{{instruction}}");
  invariant(instructionSegments[1], "Instruction segment not found");
  const inputSegments = instructionSegments[1].split("{{input}}");
  invariant(inputSegments[1], "Input segment not found");
  const incorrectOutputSegments = inputSegments[1].split("{{incorrectOutput}}");
  invariant(incorrectOutputSegments[1], "Incorrect output segment not found");
  const expectedOutputSegments =
    incorrectOutputSegments[1].split("{{expectedOutput}}");
  invariant(expectedOutputSegments[1], "Expected output segment not found");
  const failureReasonSegments =
    expectedOutputSegments[1].split("{{failureReason}}");
  invariant(failureReasonSegments[1], "Failure reason segment not found");
  return (
    taskSegments[0] +
    params.task +
    instructionSegments[0] +
    params.instruction +
    inputSegments[0] +
    params.input +
    incorrectOutputSegments[0] +
    params.incorrectOutput +
    expectedOutputSegments[0] +
    params.expectedOutput +
    failureReasonSegments[0] +
    params.failureReason +
    failureReasonSegments[1]
  );
};

export const OPTIMIZATION_APPLY_SUGGESTIONS_PROMPT_TEMPLATE = `
One or more suggestions have been provided for how to improve some instruction:

<SUGGESTIONS>
{{suggestions}}
</SUGGESTIONS>

Apply the suggestions to the following instruction:

<INSTRUCTION>
{{instruction}}
</INSTRUCTION>

Only return the improved instruction with suggestions applied.
Return no additional text or comments.
`.trim();

export const optimizationApplySuggestionsPromptTemplater = (params: {
  suggestions: string[];
  instruction: string;
}) => {
  const suggestions = params.suggestions
    .map((s) => `<SUGGESTION>${s}</SUGGESTION>`)
    .join("\n");
  const suggestionSegments =
    OPTIMIZATION_APPLY_SUGGESTIONS_PROMPT_TEMPLATE.split("{{suggestions}}");
  invariant(suggestionSegments[1], "Suggestions segment not found");
  const instructionSegments = suggestionSegments[1].split("{{instruction}}");
  invariant(instructionSegments[1], "Instruction segment not found");
  return (
    suggestionSegments[0] +
    suggestions +
    instructionSegments[0] +
    params.instruction +
    instructionSegments[1]
  );
};
