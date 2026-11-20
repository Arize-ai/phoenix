import { approvalOutcome } from "@phoenix/agent/shared/pendingApproval";
import { isOperationCallApprovalGranted } from "@phoenix/agent/uiOperations/scriptApprovalGrant";
import { parseUIOperationCallContext } from "@phoenix/agent/uiOperations/types";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import {
  describeOpenedGalleryForm,
  type GalleryItemToOpen,
  type ProjectEvaluatorGalleryListing,
  readProjectEvaluatorGalleryInputSchema,
  resolveProjectEvaluatorGalleryItem,
  openProjectEvaluatorGalleryItemInputSchema,
} from "./gallery";

/** What the project's evaluators page exposes to the gallery operations. */
export type ProjectEvaluatorGalleryHost = {
  /** What the gallery modal would show for this project. */
  loadListing: () => Promise<ProjectEvaluatorGalleryListing>;
  /**
   * Opens the form the item's card opens, the way pressing it would, and
   * returns the path it navigated to.
   */
  openItem: (item: GalleryItemToOpen) => string;
};

const NOT_MOUNTED_ERROR =
  "The project's evaluators page is not open; navigate with navigation.goTo " +
  "to /projects/<projectId>/evaluators first.";

function formatInputError({
  operationName,
  issues,
}: {
  operationName: string;
  issues: { path: PropertyKey[]; message: string }[];
}) {
  return `Invalid ${operationName} input: ${issues
    .map(({ path, message }) =>
      path.length ? `${path.join(".")}: ${message}` : message
    )
    .join("; ")}`;
}

async function loadListing(
  host: ProjectEvaluatorGalleryHost
): Promise<
  | { ok: true; listing: ProjectEvaluatorGalleryListing }
  | { ok: false; error: string }
> {
  try {
    return { ok: true, listing: await host.loadListing() };
  } catch (error) {
    return {
      ok: false,
      error: `The evaluator gallery could not be loaded: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }
}

export function createReadProjectEvaluatorGalleryClientAction({
  getHost,
}: {
  getHost: () => ProjectEvaluatorGalleryHost | null;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = readProjectEvaluatorGalleryInputSchema.safeParse(
      input ?? {}
    );
    if (!parsed.success) {
      return {
        ok: false,
        error: formatInputError({
          operationName: "evaluators.project.gallery.read",
          issues: parsed.error.issues,
        }),
      };
    }
    const host = getHost();
    if (!host) {
      return { ok: false, error: NOT_MOUNTED_ERROR };
    }
    const loaded = await loadListing(host);
    if (!loaded.ok) {
      return loaded;
    }
    const { templateName } = parsed.data;
    if (templateName != null) {
      const resolved = resolveProjectEvaluatorGalleryItem({
        listing: loaded.listing,
        input: { templateName },
      });
      if (!resolved.ok) {
        return resolved;
      }
      return {
        ok: true,
        output: {
          template: loaded.listing.templates.find(
            ({ name }) => name === templateName
          ),
        },
      };
    }
    // The cards show no details text or prompt; those are the details pane's.
    return {
      ok: true,
      output: {
        templates: loaded.listing.templates.map(
          ({ details: _details, promptMessages: _promptMessages, ...card }) =>
            card
        ),
        customEvaluators: loaded.listing.customEvaluators,
      },
    };
  };
}

/**
 * Opens the creation form a gallery card opens, under the enclosing script's
 * approval as navigation is: nothing is saved until that form is submitted.
 */
export function createOpenProjectEvaluatorGalleryItemClientAction({
  getHost,
  shouldAutoAccept = () => false,
}: {
  getHost: () => ProjectEvaluatorGalleryHost | null;
  shouldAutoAccept?: () => boolean;
}) {
  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const callContext = parseUIOperationCallContext(context);
    if (!callContext) {
      return {
        ok: false,
        error: "Cannot open a gallery item without an operation call context.",
      };
    }
    const parsed = openProjectEvaluatorGalleryItemInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: formatInputError({
          operationName: "evaluators.project.gallery.open",
          issues: parsed.error.issues,
        }),
      };
    }
    if (
      !shouldAutoAccept() &&
      !isOperationCallApprovalGranted(callContext.callId)
    ) {
      return {
        ok: false,
        error:
          "Opening a gallery item navigates the user, so it needs an approved script; describe it in write_description.",
      };
    }
    const host = getHost();
    if (!host) {
      return { ok: false, error: NOT_MOUNTED_ERROR };
    }
    const loaded = await loadListing(host);
    if (!loaded.ok) {
      return loaded;
    }
    const resolved = resolveProjectEvaluatorGalleryItem({
      listing: loaded.listing,
      input: parsed.data,
    });
    if (!resolved.ok) {
      return resolved;
    }
    const path = host.openItem(resolved.item);
    return {
      ok: true,
      output: {
        status: "opened",
        path,
        next: describeOpenedGalleryForm(resolved.item),
        ...approvalOutcome({ decision: "accepted", source: "auto" }),
      },
    };
  };
}
