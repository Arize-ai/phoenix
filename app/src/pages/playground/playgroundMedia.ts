import type { MediaKind } from "@phoenix/schemas/promptSchemas";
import type {
  PlaygroundInput,
  PlaygroundInstance,
} from "@phoenix/store/playground";

/**
 * Which media a playground template declares, and of what kind.
 *
 * Separate from `playgroundUtils` on purpose: that module is large and changes
 * often for reasons unrelated to media, so keeping this here lets the two evolve
 * without touching each other.
 */

/** The variable-name-to-value map upstream derives, whose values may be unset. */
type VariablesMap = Record<string, string | undefined>;

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

/**
 * Media variables layered onto whatever `getVariablesMapFromInstances` returned.
 *
 * The fork adds media variables to a derivation that upstream owns, and doing that
 * by editing `getVariablesMapFromInstances` meant rewriting lines inside one of the
 * busiest files in the app. Layering on the outside keeps upstream's function
 * untouched and puts the media logic here, where it can only conflict with itself.
 *
 * A media variable is declared by a message part, not by template syntax, so it
 * survives a `NONE` template format even though text variables do not — which is
 * why the keys are unioned in rather than filtered by format.
 *
 * @param base What upstream derived: the text variables and their values.
 * @param instances The instances to read media declarations from.
 * @param input The playground input, for cached values.
 */
export const withMediaVariables = (
  base: { variablesMap: VariablesMap; variableKeys: string[] },
  {
    instances,
    input,
  }: {
    instances: PlaygroundInstance[];
    input: Pick<PlaygroundInput, "variablesValueCache">;
  }
): {
  variablesMap: VariablesMap;
  variableKeys: string[];
  mediaVariableKeys: string[];
  mediaVariableKinds: Record<string, MediaKind>;
} => {
  const declarations = extractMediaVariableDeclarationsFromInstances({
    instances,
  });
  const cache = input.variablesValueCache ?? {};
  const variablesMap: VariablesMap = { ...base.variablesMap };
  const mediaVariableKinds: Record<string, MediaKind> = {};
  for (const { variable, kind } of declarations) {
    variablesMap[variable] = cache[variable] || "";
    mediaVariableKinds[variable] = kind;
  }
  return {
    variablesMap,
    variableKeys: Array.from(
      new Set([...base.variableKeys, ...declarations.map((d) => d.variable)])
    ),
    mediaVariableKeys: declarations.map((d) => d.variable),
    mediaVariableKinds,
  };
};

/**
 * The media variable values a run has to carry.
 *
 * The server substitutes a media reference out of the run's template variables like
 * any other value, so a media variable missing from that map means the model is sent
 * a prompt with the media slot unfilled and nothing reports a problem.
 */
export const withMediaVariableValues = (
  variablesMap: VariablesMap,
  {
    instances,
    input,
  }: {
    instances: PlaygroundInstance[];
    input: Pick<PlaygroundInput, "variablesValueCache">;
  }
): VariablesMap =>
  withMediaVariables({ variablesMap, variableKeys: [] }, { instances, input })
    .variablesMap;

/** A media content part as the chat-completion wire format names it. */
export type MediaContentPartInput =
  | { image: { url: string; mediaType: string } }
  | { imageVariable: { variable: string } }
  | { file: { url: string; mediaType: string } }
  | { fileVariable: { variable: string } };

/**
 * A message's media as content parts, in the order the editor lays them out:
 * text first (added by the caller), then pictures, then papers.
 *
 * The wire format names the variable variants separately — `imageVariable` rather
 * than `image` — so the one-of input stays unambiguous between a stored reference
 * and a named one.
 */
export const mediaContentPartInputs = (message: {
  images?: { image: { url: string; mediaType: string } }[];
  imageVariables?: { image: { variable: string } }[];
  files?: { file: { url: string; mediaType: string } }[];
  fileVariables?: { file: { variable: string } }[];
}): MediaContentPartInput[] => [
  ...(message.images ?? []).map(({ image }) => ({
    image: { url: image.url, mediaType: image.mediaType },
  })),
  ...(message.imageVariables ?? []).map(({ image }) => ({
    imageVariable: { variable: image.variable },
  })),
  ...(message.files ?? []).map(({ file }) => ({
    file: { url: file.url, mediaType: file.mediaType },
  })),
  ...(message.fileVariables ?? []).map(({ file }) => ({
    fileVariable: { variable: file.variable },
  })),
];
