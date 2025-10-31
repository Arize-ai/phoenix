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
   * Whether to disable the tools.
   */
  disableTools?: boolean;
  /**
   * Whether to disable the response format.
   */
  disableResponseFormat?: boolean;
}
