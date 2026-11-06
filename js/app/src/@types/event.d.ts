declare type PromptResponse = {
  /**
   * A prompt that a LLM model takes in as input
   */
  prompt?: string | null;
  /**
   * A response that a LLM model outputs to the prompt
   */
  response?: string | null;
};
