/**
 * Option shapes shared across `px` command handlers.
 *
 * Commander hands a handler one object keyed by the camelCase form of every
 * flag the command registered, so these interfaces are the typed mirror of
 * those flag declarations: `--api-key` arrives as `apiKey`, `--no-progress`
 * as `progress: false`. A command's own options interface extends the bases
 * matching the flags it registers, and documents only the fields unique to it.
 *
 * Fields are optional because Commander only populates the ones the user
 * passed, plus any the flag itself declares a default for. Handlers must not
 * read the environment directly — pass these values to `resolveConfig()`,
 * which layers flags over the active profile, then env vars, then defaults.
 */

/**
 * Flags for reaching a Phoenix server. Every command that makes an API call
 * accepts these; both are overrides layered on top of the resolved config.
 */
export interface ConnectionOptions {
  /**
   * `--endpoint <url>`: Base URL of the Phoenix server. Overrides the active
   * profile and `PHOENIX_HOST`; defaults to `http://localhost:6006`.
   *
   * @example "https://app.phoenix.arize.com"
   */
  endpoint?: string;
  /**
   * `--api-key <key>`: API key used to authenticate. Overrides the active
   * profile and `PHOENIX_API_KEY`. Omit for a local server with auth disabled.
   *
   * @example "phx-abc123"
   */
  apiKey?: string;
}

/**
 * The `--no-progress` flag, present on every command that writes status
 * updates while it works.
 */
export interface ProgressOptions {
  /**
   * `--no-progress`: Whether to write progress updates, so it reads inverted
   * from the flag — Commander defaults it to `true` and sets it to `false`
   * only when `--no-progress` is passed. Progress goes to stderr; agents
   * suppress it to keep stderr free of anything but errors.
   *
   * @example false // px span list --no-progress
   */
  progress?: boolean;
}

/**
 * The confirmation escape hatch on destructive commands. Without it, a
 * command that deletes data prompts before proceeding; with no TTY attached
 * the prompt is skipped and the command proceeds as if confirmed.
 */
export interface ConfirmationOptions {
  /**
   * `--yes` (with a `-y` short form on every delete verb except
   * `px profile delete`): Skip the "are you sure?" prompt. Required for
   * unattended and agent invocations.
   *
   * @example true // px project delete my-project --yes
   */
  yes?: boolean;
}

/**
 * Base for any command that prints a resource. `TFormat` is the union of
 * formats that command's formatter accepts — the standard three unless the
 * command adds its own (e.g. `px prompt get` also supports `text`).
 */
export interface CommonOptions<
  TFormat extends string = "pretty" | "json" | "raw",
>
  extends ConnectionOptions, ProgressOptions {
  /**
   * `--format <format>`: How the result is rendered on stdout. `pretty`
   * (the default) is a human-readable table, `json` is indented JSON, and
   * `raw` is single-line JSON for piping into `jq` or into an agent.
   *
   * @example "raw" // px project list --format raw | jq '.[].id'
   */
  format?: TFormat;
}

/**
 * Base for commands that act within a single project. The project is an
 * override: it falls back to the active profile, then `PHOENIX_PROJECT`
 * (alias `PHOENIX_PROJECT_NAME`).
 */
export interface ProjectScopedOptions<
  TFormat extends string = "pretty" | "json" | "raw",
> extends CommonOptions<TFormat> {
  /**
   * `--project <name>`: Project name or ID to read from. Names are resolved
   * to IDs against the server; hex-looking values are used as IDs directly.
   *
   * @example "my-app"
   */
  project?: string;
}

/**
 * The `--include-annotations` / `--include-notes` pair, shared by the span,
 * trace, and session read commands. Both cost an extra fetch per record, so
 * they are opt-in.
 */
export interface AnnotationInclusionOptions {
  /**
   * `--include-annotations`: Attach each record's annotations to the output.
   *
   * @example true // px trace list --include-annotations
   */
  includeAnnotations?: boolean;
  /**
   * `--include-notes`: Attach each record's notes (the `note` annotation) to
   * the output.
   *
   * @example true // px span list --include-notes
   */
  includeNotes?: boolean;
}

/**
 * Options for the delete verbs (`px project delete`, `px trace delete`, …).
 * These take no `--format`: they report what they removed as plain text.
 */
export type DeleteOptions = ConnectionOptions &
  ProgressOptions &
  ConfirmationOptions;

/**
 * Options for the annotate verbs — `px span annotate`, `px trace annotate`,
 * and `px session annotate` take an identical flag set, differing only in the
 * positional ID they act on.
 *
 * `name` is required, and at least one of `label`, `score`, or `explanation`
 * must be supplied — an annotation with no result is rejected as
 * `INVALID_ARGUMENT`.
 */
export interface AnnotateOptions extends CommonOptions {
  /**
   * `--name <name>`: Name of the annotation, matching an annotation config.
   * Required.
   *
   * @example "hallucination"
   */
  name?: string;
  /**
   * `--label <label>`: Categorical result of the annotation.
   *
   * @example "factual"
   */
  label?: string;
  /**
   * `--score <number>`: Numeric result of the annotation, parsed from the
   * flag string.
   *
   * @example "0.95"
   */
  score?: string;
  /**
   * `--explanation <text>`: Free-text rationale for the result.
   *
   * @example "The answer cites a source that does not exist."
   */
  explanation?: string;
  /**
   * `--annotator-kind <kind>`: Who produced the annotation — `HUMAN`, `LLM`,
   * or `CODE`. Defaults to `HUMAN`.
   *
   * @example "LLM"
   */
  annotatorKind?: string;
  /**
   * `--identifier <string>`: Caller-supplied key that makes annotating
   * idempotent — repeated calls with the same identifier overwrite that
   * annotation instead of appending a second one. Defaults to the empty
   * string, the server-side default.
   *
   * @example "nightly-eval"
   */
  identifier?: string;
}

/**
 * Options for the add-note verbs — `px span add-note`, `px trace add-note`,
 * and `px session add-note` share this flag set. A note is an annotation with
 * the reserved name `note`, carrying free text instead of a label or score.
 */
export interface AddNoteOptions extends CommonOptions {
  /**
   * `--text <text>`: Body of the note. Required.
   *
   * @example "Retrieval returned the wrong chunk for this query."
   */
  text?: string;
  /**
   * `--identifier <string>`: Caller-supplied key that makes the note
   * idempotent — repeated calls with the same identifier overwrite that note.
   * When omitted, the server stamps a unique `px-<target>-note:<uuid>`
   * identifier, so each call appends a new note.
   *
   * @example "triage-2026-07"
   */
  identifier?: string;
}

/**
 * Options for the annotation-delete commands — `px span-annotations delete`,
 * `px trace-annotations delete`, and `px session-annotations delete` share
 * this flag set.
 *
 * The delete must be authorized in one of two ways: bound it to a time window
 * (both `startTime` and `endTime`) or pass `all` to accept that it spans all
 * time. Without one of those the command exits `INVALID_ARGUMENT`. The
 * narrowing filters (`identifier`, `name`, `annotatorKind`) are optional on
 * top of that and combine with AND.
 */
export interface AnnotationsDeleteOptions
  extends ProjectScopedOptions, ConfirmationOptions {
  /**
   * `--identifier <id>`: Delete only the annotation with this identifier —
   * the same key passed when annotating.
   *
   * @example "nightly-eval"
   */
  identifier?: string;
  /**
   * `--name <name>`: Delete only annotations with this name.
   *
   * @example "hallucination"
   */
  name?: string;
  /**
   * `--annotator-kind <kind>`: Delete only annotations produced by this kind
   * of annotator — `HUMAN`, `LLM`, or `CODE`.
   *
   * @example "LLM"
   */
  annotatorKind?: string;
  /**
   * `--start-time <iso>`: Inclusive lower bound on `created_at` (ISO 8601).
   * Required together with `endTime` unless `all` is set.
   *
   * @example "2026-07-01T00:00:00Z"
   */
  startTime?: string;
  /**
   * `--end-time <iso>`: Exclusive upper bound on `created_at` (ISO 8601).
   * Required together with `startTime` unless `all` is set.
   *
   * @example "2026-07-13T00:00:00Z"
   */
  endTime?: string;
  /**
   * `--all`: Authorize a delete that is not bounded by a time window, so
   * wiping every matching annotation across all time can never be a typo.
   *
   * @example true // px span-annotations delete --name hallucination --all -y
   */
  all?: boolean;
}
