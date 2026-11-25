import { z } from "zod";

import type { useModelMenuDataQuery } from "@phoenix/components/generative/__generated__/useModelMenuDataQuery.graphql";
import { getProviderKeyForGenerativeModelSDK } from "@phoenix/components/generative/modelProviderUtils";
import { getCustomProviders } from "@phoenix/components/generative/useModelMenuData";

/** A decision model, in the target shape `playground.model.list` uses. */
export const decisionModelTargetSchema = z
  .discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("builtin"),
      provider: z.string().describe("Built-in provider key, e.g. `TYPESAFE`."),
      modelName: z.string(),
    }),
    z.strictObject({
      type: z.literal("custom"),
      customProviderId: z.string(),
      modelName: z.string(),
    }),
  ])
  .describe(
    "The decision model to use. Take it verbatim from `availableModels[].target` " +
      "in evaluators.decision.read."
  );

export type DecisionModelTarget = z.output<typeof decisionModelTargetSchema>;

/** One decision model the form's model menu offers. */
export type DecisionModelOption = {
  target: DecisionModelTarget;
  /** The provider the decision is saved with (a custom provider's SDK decides it). */
  provider: string;
  customProviderName: string | null;
};

/**
 * The decision models the form's model menu lists: the built-in providers'
 * decision models, and each custom provider that serves decisions with its
 * decision model names. Mirrors the menu's Decision tab.
 */
export function toDecisionModelOptions(
  data: useModelMenuDataQuery["response"]
): DecisionModelOption[] {
  const decisionProviders = new Set(
    data.modelProviders
      .filter((provider) => provider.modelTypes.includes("DECISION"))
      .map((provider) => provider.key as string)
  );
  const builtins: DecisionModelOption[] = (data.decisionModels ?? [])
    .filter((model) => decisionProviders.has(model.providerKey))
    .map((model) => ({
      target: {
        type: "builtin",
        provider: model.providerKey,
        modelName: model.name,
      },
      provider: model.providerKey,
      customProviderName: null,
    }));
  const customs: DecisionModelOption[] = getCustomProviders({
    edges: data.generativeModelCustomProviders.edges,
    modelType: "DECISION",
  }).flatMap((provider) =>
    provider.modelNames.map((modelName) => ({
      target: {
        type: "custom",
        customProviderId: provider.id,
        modelName,
      },
      provider: getProviderKeyForGenerativeModelSDK(provider.sdk),
      customProviderName: provider.name,
    }))
  );
  return [...builtins, ...customs];
}

const isSameTarget = ({
  left,
  right,
}: {
  left: DecisionModelTarget;
  right: DecisionModelTarget;
}) =>
  left.type === "builtin" && right.type === "builtin"
    ? left.provider === right.provider && left.modelName === right.modelName
    : left.type === "custom" && right.type === "custom"
      ? left.customProviderId === right.customProviderId &&
        left.modelName === right.modelName
      : false;

/** The menu option a target names, or why it names none. */
export function findDecisionModelOption({
  target,
  options,
}: {
  target: DecisionModelTarget;
  options: readonly DecisionModelOption[];
}): { ok: true; option: DecisionModelOption } | { ok: false; error: string } {
  const option = options.find((candidate) =>
    isSameTarget({ left: candidate.target, right: target })
  );
  if (option) {
    return { ok: true, option };
  }
  const label =
    target.type === "builtin"
      ? `${target.provider} ${target.modelName}`
      : `${target.modelName} on custom provider ${target.customProviderId}`;
  return {
    ok: false,
    error:
      `${label} is not a decision model this form offers. Pick one from ` +
      "`availableModels` in evaluators.decision.read.",
  };
}
