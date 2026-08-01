import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Flex,
  Heading,
  Icon,
  Icons,
  ProgressBar,
  Text,
  View,
} from "@phoenix/components";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { HomePageQuery as HomePageQueryType } from "./__generated__/HomePageQuery.graphql";
import { OnboardingChecklist } from "./OnboardingChecklist";
import type { ChecklistStep } from "./OnboardingChecklist";

const HomePageQuery = graphql`
  query HomePageQuery {
    datasetCount
    evaluatorCount
    modelProviders {
      credentialsSet
      credentialRequirements {
        isRequired
      }
    }
    projects(first: 100) {
      edges {
        node {
          traceCount
        }
      }
    }
  }
`;

/**
 * Derives the onboarding checklist from live backend state. Each step's
 * completion is computed purely from the query result, so the checklist is
 * always accurate and needs no local persistence. Exported for unit testing.
 */
export function computeChecklistSteps(
  data: HomePageQueryType["response"],
  browserCredentialProviderCount = 0
): ChecklistStep[] {
  const totalTraces = (data.projects?.edges ?? []).reduce(
    (sum, edge) => sum + (edge.node.traceCount ?? 0),
    0
  );
  // A provider that requires no credentials (e.g. Ollama) reports
  // `credentialsSet: true` trivially — it needs no key. Only count providers
  // that actually require credentials AND have them set on the server, so this
  // step reflects a real API key the user added rather than a no-auth provider.
  const serverProvidersWithCredentials = (data.modelProviders ?? []).filter(
    (provider) =>
      provider.credentialsSet &&
      provider.credentialRequirements.some(
        (requirement) => requirement.isRequired
      )
  ).length;
  // Credentials can also live client-side: the playground stores provider keys
  // in the browser (localStorage), which never set `credentialsSet` on the
  // server. Count those too so a key added in this browser marks the step
  // complete and reflects what actually unlocks the playground.
  const connectedProviderCount =
    serverProvidersWithCredentials + browserCredentialProviderCount;
  const datasetCount = data.datasetCount ?? 0;
  const evaluatorCount = data.evaluatorCount ?? 0;

  return [
    {
      id: "trace",
      title: "Log your first trace",
      description:
        "Instrument your app and send a trace to see what your LLM is doing.",
      icon: <Icons.Trace />,
      isComplete: totalTraces > 0,
      cta: { label: "Go to projects", to: "/projects" },
      stat: {
        label: totalTraces === 1 ? "trace logged" : "traces logged",
        value: totalTraces.toLocaleString(),
      },
    },
    {
      id: "api-key",
      title: "Add a model API key",
      description:
        "Unlock the playground and LLM-as-a-judge evaluators by configuring a provider.",
      icon: <Icons.Key />,
      isComplete: connectedProviderCount > 0,
      cta: { label: "Configure providers", to: "/settings/providers" },
      stat: {
        label:
          connectedProviderCount === 1
            ? "provider connected"
            : "providers connected",
        value: connectedProviderCount.toLocaleString(),
      },
    },
    {
      id: "dataset",
      title: "Create your first dataset",
      description:
        "Curate examples from your traces to test and benchmark changes.",
      icon: <Icons.Database />,
      isComplete: datasetCount > 0,
      cta: { label: "Go to datasets", to: "/datasets" },
      stat: {
        label: datasetCount === 1 ? "dataset created" : "datasets created",
        value: datasetCount.toLocaleString(),
      },
    },
    {
      id: "evaluator",
      title: "Create your first evaluator",
      description:
        "Score your traces automatically to measure quality and catch regressions.",
      icon: <Icons.Scale />,
      isComplete: evaluatorCount > 0,
      cta: { label: "Go to evaluators", to: "/evaluators" },
      stat: {
        label:
          evaluatorCount === 1 ? "evaluator created" : "evaluators created",
        value: evaluatorCount.toLocaleString(),
      },
    },
  ];
}

/**
 * The Home page: a stateful onboarding checklist that guides new users through
 * Phoenix's core loop — trace → evaluate → improve. Every step's completion is
 * derived from live backend state (this single query), so it is always accurate
 * and needs no local persistence. Completed steps collapse to reveal a small
 * stat; undone steps show a call-to-action linking to the relevant page.
 */
export function HomePage() {
  const data = useLazyLoadQuery<HomePageQueryType>(
    HomePageQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  // Count providers that have at least one non-empty credential stored in the
  // browser (the playground's client-side keys). These never surface on the
  // server's `credentialsSet`, so we detect them here to complete the api-key
  // step for users who added a key in this browser.
  const browserCredentialProviderCount = useCredentialsContext((state) =>
    Object.entries(state).reduce((count, [key, value]) => {
      if (
        isModelProvider(key) &&
        value &&
        typeof value === "object" &&
        Object.values(value).some(
          (credential) =>
            typeof credential === "string" && credential.trim().length > 0
        )
      ) {
        return count + 1;
      }
      return count;
    }, 0)
  );

  const steps = useMemo<ChecklistStep[]>(
    () => computeChecklistSteps(data, browserCredentialProviderCount),
    [data, browserCredentialProviderCount]
  );

  const completedCount = steps.filter((step) => step.isComplete).length;
  const totalCount = steps.length;
  const allComplete = completedCount === totalCount;

  return (
    <main css={{ overflowY: "auto", height: "100%" }} data-testid="home-page">
      <View
        paddingX="size-400"
        paddingY="size-600"
        marginStart="auto"
        marginEnd="auto"
        maxWidth={720}
        width="100%"
      >
        <Flex direction="column" gap="size-400">
          <Flex direction="column" gap="size-100">
            <Flex direction="row" gap="size-100" alignItems="center">
              <Icon svg={<Icons.Sparkle />} />
              <Heading level={1} weight="heavy">
                {allComplete ? "You're all set" : "Welcome to Phoenix"}
              </Heading>
            </Flex>
            <Text size="L" color="text-700">
              {allComplete
                ? "You've completed the getting-started checklist. Keep iterating on the trace → evaluate → improve loop."
                : "Follow these steps to trace, evaluate, and improve your LLM app."}
            </Text>
          </Flex>

          <Flex direction="column" gap="size-100">
            <Flex direction="row" justifyContent="space-between">
              <Text size="S" weight="heavy" color="text-700">
                Getting started
              </Text>
              <Text size="S" color="text-700">
                {completedCount} of {totalCount} complete
              </Text>
            </Flex>
            <ProgressBar
              width="100%"
              aria-label="Onboarding progress"
              value={completedCount}
              minValue={0}
              maxValue={totalCount}
            />
          </Flex>

          <OnboardingChecklist steps={steps} />
        </Flex>
      </View>
    </main>
  );
}
