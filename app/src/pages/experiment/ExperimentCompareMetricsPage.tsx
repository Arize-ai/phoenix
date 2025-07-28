import { css } from "@emotion/react";

import { Flex, Heading, Icon, Icons, Text, View } from "@phoenix/components";

const metricCardCss = css`
  padding: var(--ac-global-dimension-size-200);
  border: 1px solid var(--ac-global-color-grey-400);
  background-color: var(--ac-global-color-grey-100);
  box-shadow:
    0 0 1px 0px var(--ac-global-color-grey-400) inset,
    0 0 1px 0px var(--ac-global-color-grey-400);
  border-radius: var(--ac-global-rounding-medium);
  transition: border-color 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--ac-global-dimension-size-200);
  height: 100%;
`;

export function ExperimentCompareMetricsPage() {
  return (
    <View padding="size-200" width="100%">
      <ul
        css={css`
          display: grid;
          grid-template-columns: repeat(
            auto-fill,
            minmax(var(--ac-global-dimension-size-3600), 1fr)
          );
          gap: var(--ac-global-dimension-size-200);
        `}
      >
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
            & > div {
              height: 100%;
            }
          `}
        >
          <div css={metricCardCss}>
            <Flex direction="column" gap="size-200">
              <Heading level={2}>Latency</Heading>
              <Flex direction="row" justifyContent="space-between">
                <Text>520ms</Text>
                <ImprovementAndRegressionCounter
                  numImprovements={10}
                  numRegressions={5}
                />
              </Flex>
            </Flex>
          </div>
        </li>
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
            & > div {
              height: 100%;
            }
          `}
        >
          <div css={metricCardCss}>
            <Heading level={2}>Prompt Tokens</Heading>
          </div>
        </li>
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
            & > div {
              height: 100%;
            }
          `}
        >
          <div css={metricCardCss}>
            <Heading level={2}>Completion Tokens</Heading>
          </div>
        </li>
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
            & > div {
              height: 100%;
            }
          `}
        >
          <div css={metricCardCss}>
            <Heading level={2}>Total Tokens</Heading>
          </div>
        </li>
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
            & > div {
              height: 100%;
            }
          `}
        >
          <div css={metricCardCss}>
            <Heading level={2}>Cost</Heading>
          </div>
        </li>
      </ul>
    </View>
  );
}

function ImprovementAndRegressionCounter({
  numImprovements,
  numRegressions,
}: {
  numImprovements: number;
  numRegressions: number;
}) {
  return (
    <Flex direction="row" gap="size-50">
      {numImprovements > 0 && (
        <Flex direction="row" alignItems="center">
          <Icon svg={<Icons.ArrowUpwardOutline />} color="green-900" />
          <Text size="M" color="green-900">
            {numImprovements}
          </Text>
        </Flex>
      )}
      {numRegressions > 0 && (
        <Flex direction="row" alignItems="center">
          <Icon svg={<Icons.ArrowDownwardOutline />} color="red-900" />
          <Text size="M" color="red-900">
            {numRegressions}
          </Text>
        </Flex>
      )}
    </Flex>
  );
}
