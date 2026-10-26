import { Alert, Link, View } from "@phoenix/components";

/**
 * Shown when a /prompts/:promptId route resolves to neither a prompt nor a
 * decision. The loaders throw a 404 first, so this only guards the types.
 */
export function PromptNotFound() {
  return (
    <View padding="size-200">
      <Alert variant="danger">
        This prompt or decision could not be found. It may have been deleted.
      </Alert>
      <Link to="/prompts">Back to prompts</Link>
    </View>
  );
}
