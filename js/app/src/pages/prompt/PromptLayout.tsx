import { useFragment, usePreloadedQuery } from "react-relay";
import { graphql } from "relay-runtime";

import { DecisionLayout } from "@phoenix/pages/decision/DecisionLayout";
import { ClonePromptDialog } from "@phoenix/pages/prompt/ClonePromptDialog";

import type { PromptLayout__main$key } from "./__generated__/PromptLayout__main.graphql";
import type { promptLoaderQuery as promptLoaderQueryType } from "./__generated__/promptLoaderQuery.graphql";
import { PromptLayoutShell } from "./PromptLayoutShell";
import { promptLoaderQuery } from "./promptLoader";
import { PromptNotFound } from "./PromptNotFound";
import { usePromptIdLoader } from "./usePromptIdLoader";

/**
 * The layout for /prompts/:promptId. The id may name a prompt or a decision;
 * both share the same header and tabs.
 */
export function PromptLayout() {
  const loaderData = usePromptIdLoader();
  const preloadedData = usePreloadedQuery<promptLoaderQueryType>(
    promptLoaderQuery,
    loaderData.queryRef
  );
  const node = preloadedData.prompt;
  switch (node.__typename) {
    case "Prompt":
      return <PromptLayoutContent prompt={node} />;
    case "Decision":
      return <DecisionLayout decision={node} />;
    default:
      return <PromptNotFound />;
  }
}

function PromptLayoutContent({ prompt }: { prompt: PromptLayout__main$key }) {
  const data = useFragment<PromptLayout__main$key>(
    graphql`
      fragment PromptLayout__main on Prompt {
        id
        name
        description
        metadata
        versionCount
        sourcePrompt {
          id
          name
        }
      }
    `,
    prompt
  );

  return (
    <PromptLayoutShell
      id={data.id}
      name={data.name}
      kindLabel="Prompt"
      source={data.sourcePrompt}
      cloneDialog={
        <ClonePromptDialog
          promptId={data.id}
          promptName={data.name}
          promptDescription={data.description ?? undefined}
          promptMetadata={data.metadata ?? undefined}
        />
      }
      playgroundTo={`/playground?promptId=${encodeURIComponent(data.id)}`}
      playgroundAriaLabel="Open this Prompt in Playground"
      versionCount={data.versionCount}
    />
  );
}
