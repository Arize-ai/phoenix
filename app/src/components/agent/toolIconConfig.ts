import type { IconKey } from "@phoenix/components";

/**
 * Broad semantic categories used to keep PXI tool-call iconography consistent.
 * Tools without a strong category deliberately fall back to the wrench.
 */
export type ToolIconCategory =
  | "ask"
  | "command"
  | "configure"
  | "data"
  | "delegate"
  | "edit"
  | "filter"
  | "navigate"
  | "read"
  | "run"
  | "search"
  | "skill"
  | "time"
  | "visualize"
  | "web";

export const TOOL_ICON_BY_CATEGORY = {
  ask: "MessagesSquare",
  command: "Console",
  configure: "Options",
  data: "Database",
  delegate: "Subagent",
  edit: "Edit2",
  filter: "ListFilter",
  navigate: "ArrowUpRightCorner",
  read: "ScanText",
  run: "Play",
  search: "Search",
  skill: "GraduationCap",
  time: "Clock",
  visualize: "BarChart",
  web: "Globe",
} as const satisfies Record<ToolIconCategory, IconKey>;

/** Built-in skills with a natural Phoenix noun icon override the skill glyph. */
export const SKILL_ICON_BY_NAME: Partial<Record<string, IconKey>> = {
  "annotate-spans": "Edit2",
  datasets: "Database",
  "debug-trace": "Trace",
  evaluators: "Scale",
  experiments: "Experiment",
  "phoenix-graphql": "Code",
  playground: "Play",
  "span-coding": "PriceTags",
};

const TOOL_ICON_CATEGORY_BY_NAME: Partial<Record<string, ToolIconCategory>> = {
  // Ask
  ask_user: "ask",

  // Command execution
  bash: "command",

  // Configuration
  set_appended_messages_path: "configure",
  set_dataset_evaluator_selection: "configure",
  set_playground_experiment_recording: "configure",
  set_playground_model: "configure",
  set_playground_repetitions: "configure",
  set_template_variables_path: "configure",
  set_variable_values: "configure",

  // Dataset operations
  add_dataset_examples: "data",
  add_spans_to_dataset: "data",
  create_dataset: "data",
  create_dataset_label: "data",
  create_dataset_split: "data",
  delete_dataset: "data",
  delete_dataset_examples: "data",
  delete_dataset_labels: "data",
  delete_dataset_splits: "data",
  list_dataset_examples: "data",
  list_dataset_labels: "data",
  list_dataset_splits: "data",
  list_datasets: "data",
  list_labels: "data",
  list_splits: "data",
  load_dataset: "data",
  patch_dataset: "data",
  patch_dataset_examples: "data",
  patch_dataset_split: "data",
  set_dataset_example_splits: "data",
  set_dataset_labels: "data",

  // Delegation
  call_subagent: "delegate",

  // Edits and durable writes
  add_prompt_instance: "edit",
  batch_span_annotate: "edit",
  clone_prompt_instance: "edit",
  create_annotation_config: "edit",
  edit_code_evaluator_draft: "edit",
  edit_llm_evaluator_draft: "edit",
  edit_prompt_instance: "edit",
  patch_experiment: "edit",
  remove_prompt_instance: "edit",
  save_prompt: "edit",
  submit_code_evaluator_draft: "edit",
  submit_llm_evaluator_draft: "edit",
  update_annotation_config: "edit",
  write_prompt_tools: "edit",
  write_span_note: "edit",

  // Filtering
  set_spans_filter: "filter",

  // Navigation
  get_route_info: "navigate",
  open_code_evaluator_form: "navigate",
  open_dataset_evaluator_for_edit: "navigate",
  open_llm_evaluator_form: "navigate",

  // Read-only inspection
  list_playground_model_targets: "read",
  read_code_evaluator_draft: "read",
  read_dataset_evaluator_definition: "read",
  read_llm_evaluator_draft: "read",
  read_playground_output: "read",
  read_prompt_instance: "read",
  read_prompt_tools: "read",

  // Execution lifecycle
  run_playground: "run",
  test_code_evaluator_draft: "run",
  test_llm_evaluator_draft: "run",
  cancel_playground_run: "run",

  // Search
  query_docs_filesystem_phoenix: "search",
  search_phoenix: "search",
  web_search: "search",

  // Skills
  load_skill: "skill",
  read_skill_resource: "skill",

  // Time
  get_current_datetime: "time",
  set_time_range: "time",

  // Generative UI
  render_generative_ui: "visualize",

  // Web retrieval
  web_fetch: "web",
};

/**
 * Returns the configured icon for a PXI tool. Built-in skills use their noun
 * icon when known. Unknown tools intentionally use the generic wrench so newly
 * introduced tools are never miscategorized.
 */
export function getToolIconKey({
  toolName,
  input,
}: {
  toolName: string;
  input?: unknown;
}): IconKey {
  if (toolName === "load_skill" || toolName === "read_skill_resource") {
    const skillName = getSkillName(input);
    const skillIcon = skillName ? SKILL_ICON_BY_NAME[skillName] : undefined;
    if (skillIcon) {
      return skillIcon;
    }
  }
  const category = TOOL_ICON_CATEGORY_BY_NAME[toolName];
  return category ? TOOL_ICON_BY_CATEGORY[category] : "Wrench";
}

function getSkillName(input: unknown): string | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  const skillName = (input as Record<string, unknown>).skill_name;
  return typeof skillName === "string" ? skillName : null;
}
