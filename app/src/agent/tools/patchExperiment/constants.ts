// Must byte-match the server tool name in patch_experiment.py.
export const PATCH_EXPERIMENT_TOOL_NAME = "patch_experiment";

export const PATCH_EXPERIMENT_NAVIGATION_CANCEL_ERROR =
  "The experiment edit proposal was cancelled because the chat surface was unmounted.";

export const PATCH_EXPERIMENT_STALE_TARGET_ERROR =
  "The experiment changed after this edit was proposed, so it can no longer be applied. Re-propose the edit against the current experiment.";
