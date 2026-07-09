import { Suspense, useCallback, useState } from "react";
import { useLoaderData, useParams, useSearchParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Card,
  Flex,
  Icon,
  Icons,
  LinkButton,
  Loading,
  Switch,
  TitleWithID,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import type { TextDiffStyle } from "@phoenix/components/diff";
import { DiffStyleToggle } from "@phoenix/components/diff";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import { PromptModelConfigurationCard } from "@phoenix/pages/prompt/PromptModelConfigurationCard";
import type { PromptVersionLoaderData } from "@phoenix/pages/prompt/promptVersionLoader";
import { promptVersionLoaderQuery } from "@phoenix/pages/prompt/promptVersionLoader";

import { TagPromptVersionButton } from "../../components/prompt/TagPromptVersionButton";
import type {
  promptVersionLoaderQuery as PromptVersionLoaderQuery,
  promptVersionLoaderQuery$data,
} from "./__generated__/promptVersionLoaderQuery.graphql";
import { PromptCodeExportCard } from "./PromptCodeExportCard";
import { PromptVersionCompareSelect } from "./PromptVersionCompareSelect";
import { PromptVersionDiffCards } from "./PromptVersionDiffCards";
import { PromptVersionTagsList } from "./PromptVersionTagsList";

/**
 * Search param holding the id of the version the current version is diffed
 * against. Its presence turns on diff mode.
 */
const DIFF_BASE_PARAM = "diffBase";

export function PromptVersionDetailsPage() {
  const loaderData = useLoaderData<PromptVersionLoaderData>();
  const data = useOwnedPreloadedQuery<PromptVersionLoaderQuery>({
    query: promptVersionLoaderQuery,
    queryRef: loaderData.queryRef,
  });
  return <PromptVersionDetailsPageContent promptVersion={data.promptVersion} />;
}

function PromptVersionDetailsPageContent({
  promptVersion,
}: {
  promptVersion: promptVersionLoaderQuery$data["promptVersion"];
}) {
  const { promptId } = useParams();
  invariant(promptId, "promptId is required");
  const [searchParams, setSearchParams] = useSearchParams();
  const diffBaseId = searchParams.get(DIFF_BASE_PARAM);
  const [diffStyle, setDiffStyle] = useState<TextDiffStyle>("unified");
  const previousVersionId = promptVersion.previousVersion?.id ?? null;
  const isDiffMode = diffBaseId != null;

  const setDiffBase = useCallback(
    (versionId: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (versionId == null) {
            next.delete(DIFF_BASE_PARAM);
          } else {
            next.set(DIFF_BASE_PARAM, versionId);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  invariant(promptVersion.id, "promptVersion id is required");
  return (
    <View width="100%" overflow="auto" elementType="section">
      <View padding="size-200" width="100%" overflow="auto">
        <Flex
          direction="column"
          gap="size-200"
          maxWidth={900}
          marginStart="auto"
          marginEnd="auto"
        >
          <Flex direction="row" justifyContent="space-between">
            <Flex direction="row" gap="size-100" alignItems="center">
              <TitleWithID title="Version" id={promptVersion.id} />
              <PromptVersionTagsList promptVersion={promptVersion} />
            </Flex>
            <Flex direction="row" gap="size-100">
              <TagPromptVersionButton
                promptId={promptId}
                versionId={promptVersion.id}
              />
              <TooltipTrigger delay={0}>
                <TriggerWrap>
                  <LinkButton
                    variant="primary"
                    leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
                    to={`/playground?promptId=${encodeURIComponent(promptId)}&promptVersionId=${encodeURIComponent(promptVersion.id)}`}
                    size="S"
                    data-testid="open-prompt-version-in-playground-button"
                    aria-label="Open this Prompt version in Playground"
                  >
                    Playground
                  </LinkButton>
                </TriggerWrap>
                <Tooltip>
                  <TooltipArrow />
                  Open this Prompt version in Playground
                </Tooltip>
              </TooltipTrigger>
            </Flex>
          </Flex>
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            minHeight="size-400"
          >
            <Switch
              labelPlacement="end"
              isSelected={isDiffMode}
              isDisabled={!isDiffMode && previousVersionId == null}
              onChange={(isSelected) => {
                setDiffBase(isSelected ? previousVersionId : null);
              }}
            >
              Diff
            </Switch>
            {isDiffMode && diffBaseId != null ? (
              <Flex direction="row" gap="size-100" alignItems="center">
                <PromptVersionCompareSelect
                  promptId={promptId}
                  currentVersionId={promptVersion.id}
                  selectedVersionId={diffBaseId}
                  onChange={setDiffBase}
                />
                <DiffStyleToggle value={diffStyle} onChange={setDiffStyle} />
              </Flex>
            ) : null}
          </Flex>
          {isDiffMode && diffBaseId != null ? (
            <Suspense fallback={<Loading />}>
              <PromptVersionDiffCards
                baselineVersionId={diffBaseId}
                current={promptVersion}
                diffStyle={diffStyle}
              />
            </Suspense>
          ) : (
            <>
              <Card
                title="Prompt"
                collapsible
                data-testid="prompt-chat-messages-card"
              >
                <View padding="size-200">
                  <PromptChatMessages promptVersion={promptVersion} />
                </View>
              </Card>
              <PromptModelConfigurationCard promptVersion={promptVersion} />
            </>
          )}
          <PromptCodeExportCard promptVersion={promptVersion} />
        </Flex>
      </View>
    </View>
  );
}
