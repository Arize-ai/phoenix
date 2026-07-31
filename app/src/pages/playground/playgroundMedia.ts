import type { MediaKind } from "@phoenix/schemas/promptSchemas";
import type { PlaygroundInstance } from "@phoenix/store/playground";

/**
 * Which media a playground template declares, and of what kind.
 *
 * Separate from `playgroundUtils` on purpose: that module is large and changes
 * often for reasons unrelated to media, so keeping this here lets the two evolve
 * without touching each other.
 */

/** A media variable a template declares, and which kind of media fills it. */
export type MediaVariableDeclaration = {
  variable: string;
  kind: MediaKind;
};

/**
 * The media variables an instance expects, in the order they appear.
 *
 * A media variable is declared by a message part rather than by template syntax,
 * so it does not depend on the template format — a prompt with format `NONE` still
 * has to be given its images.
 *
 * The kind travels with the name because the Inputs panel picks a different
 * control for each: an image is chosen and previewed, a document is chosen and
 * named.
 */
export const extractMediaVariableDeclarationsFromInstance = ({
  instance,
}: {
  instance: PlaygroundInstance;
}): MediaVariableDeclaration[] => {
  if (instance.template.__type !== "chat") {
    return [];
  }
  const declarations: MediaVariableDeclaration[] = [];
  const declare = (variable: string, kind: MediaKind) => {
    // First declaration wins, so a name used for both kinds stays one input
    // rather than rendering two controls that fight over the same value.
    if (!declarations.some((existing) => existing.variable === variable)) {
      declarations.push({ variable, kind });
    }
  };
  instance.template.messages.forEach((message) => {
    (message.imageVariables ?? []).forEach((part) =>
      declare(part.image.variable, "image")
    );
    (message.fileVariables ?? []).forEach((part) =>
      declare(part.file.variable, "file")
    );
  });
  return declarations;
};

export const extractMediaVariableDeclarationsFromInstances = ({
  instances,
}: {
  instances: PlaygroundInstance[];
}): MediaVariableDeclaration[] => {
  const declarations: MediaVariableDeclaration[] = [];
  instances.forEach((instance) => {
    extractMediaVariableDeclarationsFromInstance({ instance }).forEach(
      (declaration) => {
        if (
          !declarations.some(
            (existing) => existing.variable === declaration.variable
          )
        ) {
          declarations.push(declaration);
        }
      }
    );
  });
  return declarations;
};

export const extractMediaVariablesFromInstances = ({
  instances,
}: {
  instances: PlaygroundInstance[];
}): string[] =>
  extractMediaVariableDeclarationsFromInstances({ instances }).map(
    (declaration) => declaration.variable
  );
