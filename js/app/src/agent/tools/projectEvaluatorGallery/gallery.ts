import { z } from "zod";

/** One of a gallery template's inputs, as its details list them. */
export type ProjectEvaluatorGalleryTemplateInput = {
  name: string;
  description: string | null;
  /** The path the form opens with for this input, if the template ships one. */
  defaultPath: string | null;
};

/** A gallery template, as its card and details pane show it. */
export type ProjectEvaluatorGalleryTemplate = {
  name: string;
  /** Always LLM: templates open the project LLM evaluator form. */
  kind: "LLM";
  category: string;
  description: string | null;
  /** The records it evaluates. */
  targetType: "SPAN" | "TRACE" | "SESSION";
  /** The filter the form opens with. */
  filterCondition: string;
  inputs: ProjectEvaluatorGalleryTemplateInput[];
  labels: { label: string; score: number }[];
  optimizationDirection: string;
};

/** What only a template's details pane shows. */
export type ProjectEvaluatorGalleryTemplateDetails =
  ProjectEvaluatorGalleryTemplate & {
    details: string | null;
    promptMessages: { role: string; content: string }[];
  };

/**
 * An evaluator saved elsewhere that the gallery offers: LLM evaluators open
 * as a copy, code and decision evaluators as an attach.
 */
export type ProjectEvaluatorGalleryCustomEvaluator = {
  evaluatorId: string;
  name: string;
  kind: "LLM" | "CODE" | "DECISION";
  description: string | null;
  opensAs: "copy" | "attach";
};

export type ProjectEvaluatorGalleryListing = {
  templates: ProjectEvaluatorGalleryTemplateDetails[];
  customEvaluators: ProjectEvaluatorGalleryCustomEvaluator[];
};

export const readProjectEvaluatorGalleryInputSchema = z.strictObject({
  templateName: z
    .string()
    .min(1)
    .optional()
    .describe(
      "A template's name, to read its details pane: the details text and the judge prompt. Omit to list the gallery."
    ),
});

export type ReadProjectEvaluatorGalleryInput = z.output<
  typeof readProjectEvaluatorGalleryInputSchema
>;

export const openProjectEvaluatorGalleryItemInputSchema = z.strictObject({
  templateName: z
    .string()
    .min(1)
    .optional()
    .describe("The template to start from, by name."),
  evaluatorId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "A custom evaluator from the gallery, by evaluatorId: an LLM evaluator opens as a copy, a code or decision evaluator as an attach."
    ),
});

export type OpenProjectEvaluatorGalleryItemInput = z.output<
  typeof openProjectEvaluatorGalleryItemInputSchema
>;

/** The gallery item an input names, or why it names none. */
export function resolveProjectEvaluatorGalleryItem({
  listing,
  input,
}: {
  listing: ProjectEvaluatorGalleryListing;
  input: OpenProjectEvaluatorGalleryItemInput;
}): { ok: true; item: GalleryItemToOpen } | { ok: false; error: string } {
  const { templateName, evaluatorId } = input;
  if ((templateName == null) === (evaluatorId == null)) {
    return {
      ok: false,
      error: "Pass exactly one of templateName or evaluatorId.",
    };
  }
  if (templateName != null) {
    const template = listing.templates.find(
      (candidate) => candidate.name === templateName
    );
    if (!template) {
      return {
        ok: false,
        error:
          `The gallery has no template named "${templateName}". Its templates are: ` +
          `${listing.templates.map(({ name }) => name).join(", ") || "(none)"}.`,
      };
    }
    return { ok: true, item: { kind: "template", template } };
  }
  const evaluator = listing.customEvaluators.find(
    (candidate) => candidate.evaluatorId === evaluatorId
  );
  if (!evaluator) {
    return {
      ok: false,
      error:
        `The gallery offers no evaluator with id "${evaluatorId}". Read the ` +
        "gallery with evaluators.project.gallery.read for the ids it offers; " +
        "evaluators already on this project are not offered.",
    };
  }
  return { ok: true, item: { kind: "custom", evaluator } };
}

export type GalleryItemToOpen =
  | { kind: "template"; template: ProjectEvaluatorGalleryTemplate }
  | { kind: "custom"; evaluator: ProjectEvaluatorGalleryCustomEvaluator };

/** The operations that take over once a gallery item's form is open. */
export function describeOpenedGalleryForm(item: GalleryItemToOpen): string {
  if (item.kind === "template") {
    return (
      `The project LLM evaluator form is opening, prefilled from the ` +
      `${item.template.name} template. Read it with evaluators.llm.read and ` +
      "evaluators.project.scope.read, change it with evaluators.llm.edit and " +
      "evaluators.project.scope.edit, test it with " +
      "evaluators.project.bench.run, and save it with evaluators.llm.submit."
    );
  }
  if (item.evaluator.opensAs === "copy") {
    return (
      `The project LLM evaluator form is opening with a copy of ` +
      `${item.evaluator.name}. Use the evaluators.llm.* and ` +
      "evaluators.project.* operations as on any LLM form."
    );
  }
  return (
    `The attach form for ${item.evaluator.name} is opening. Read it with ` +
    "evaluators.project.attach.read, map inputs with " +
    "evaluators.project.attach.edit, set the scope with " +
    "evaluators.project.scope.edit, test with evaluators.project.bench.run, " +
    "and attach with evaluators.project.attach.submit."
  );
}
