export interface PlaygroundInstanceProps {
  /**
   * Multiple playground instances are supported.
   * The id is used to identify the instance.
   */
  playgroundInstanceId: number;
  /**
   * Whether to disable the prompt menu.
   */
  disablePromptMenu?: boolean;
  /**
   * Whether to disable the prompt save button.
   */
  disablePromptSave?: boolean;
  /**
   * Whether to disable the new tool button.
   * Tools will still be rendered if available and disableTools is false.
   */
  disableNewTool?: boolean;
  /**
   * Whether to disable rendering tools.
   */
  disableTools?: boolean;
  /**
   * Whether to disable rendering response format.
   */
  disableResponseFormat?: boolean;
  /**
   * Whether to disable rendering the alphabetic index.
   */
  disableAlphabeticIndex?: boolean;
  /**
   * Whether to disable ephemeral routing fields (endpoint, region, base URL).
   * When true, shows informational text about env var usage instead of editable fields.
   * Used in evaluator context where routing must come from custom providers or env vars.
   */
  disableEphemeralRouting?: boolean;
}
