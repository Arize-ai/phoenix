import { css } from "@emotion/react";

import { Flex, Heading, Icon, Icons, Text, View } from "@phoenix/components";

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
          <div
            css={css`
              padding: var(--ac-global-dimension-size-200);
              border: 1px solid var(--ac-global-color-grey-400);
              background-color: var(--ac-global-color-grey-100);
              box-shadow:
                0 0 1px 0px var(--ac-global-color-grey-400) inset,
                0 0 1px 0px var(--ac-global-color-grey-400);
              border-radius: var(--ac-global-rounding-medium);
              transition: border-color 0.2s;
              &:hover {
                border-color: var(--ac-global-color-primary);
              }
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              gap: var(--ac-global-dimension-size-200);
              height: 100%;
            `}
          >
            <Flex direction="column" gap="size-200">
              <Heading level={2}>Latency</Heading>
              <Flex direction="row" justifyContent="space-between">
                <Text>520ms</Text>
                <NumberOfExamplesChanged numIncreases={10} numDecreases={5} />
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
          <div
            css={css`
              padding: var(--ac-global-dimension-size-200);
              border: 1px solid var(--ac-global-color-grey-400);
              background-color: var(--ac-global-color-grey-100);
              box-shadow:
                0 0 1px 0px var(--ac-global-color-grey-400) inset,
                0 0 1px 0px var(--ac-global-color-grey-400);
              border-radius: var(--ac-global-rounding-medium);
              transition: border-color 0.2s;
              &:hover {
                border-color: var(--ac-global-color-primary);
              }
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              gap: var(--ac-global-dimension-size-200);
              height: 100%;
            `}
          >
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
          <div
            css={css`
              padding: var(--ac-global-dimension-size-200);
              border: 1px solid var(--ac-global-color-grey-400);
              background-color: var(--ac-global-color-grey-100);
              box-shadow:
                0 0 1px 0px var(--ac-global-color-grey-400) inset,
                0 0 1px 0px var(--ac-global-color-grey-400);
              border-radius: var(--ac-global-rounding-medium);
              transition: border-color 0.2s;
              &:hover {
                border-color: var(--ac-global-color-primary);
              }
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              gap: var(--ac-global-dimension-size-200);
              height: 100%;
            `}
          >
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
          <div
            css={css`
              padding: var(--ac-global-dimension-size-200);
              border: 1px solid var(--ac-global-color-grey-400);
              background-color: var(--ac-global-color-grey-100);
              box-shadow:
                0 0 1px 0px var(--ac-global-color-grey-400) inset,
                0 0 1px 0px var(--ac-global-color-grey-400);
              border-radius: var(--ac-global-rounding-medium);
              transition: border-color 0.2s;
              &:hover {
                border-color: var(--ac-global-color-primary);
              }
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              gap: var(--ac-global-dimension-size-200);
              height: 100%;
            `}
          >
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
          <div
            css={css`
              padding: var(--ac-global-dimension-size-200);
              border: 1px solid var(--ac-global-color-grey-400);
              background-color: var(--ac-global-color-grey-100);
              box-shadow:
                0 0 1px 0px var(--ac-global-color-grey-400) inset,
                0 0 1px 0px var(--ac-global-color-grey-400);
              border-radius: var(--ac-global-rounding-medium);
              transition: border-color 0.2s;
              &:hover {
                border-color: var(--ac-global-color-primary);
              }
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              gap: var(--ac-global-dimension-size-200);
              height: 100%;
            `}
          >
            <Heading level={2}>Cost</Heading>
          </div>
        </li>
      </ul>
    </View>
  );
}

function NumberOfExamplesChanged({
  numIncreases,
  numDecreases,
}: {
  numIncreases: number;
  numDecreases: number;
}) {
  return (
    <Flex direction="row" gap="size-50">
      {numIncreases > 0 && (
        <Flex direction="row" alignItems="center">
          <Icon svg={<Icons.ArrowUpwardOutline />} color="green-900" />
          <Text size="M" color="green-900">
            {numIncreases}
          </Text>
        </Flex>
      )}
      {numDecreases > 0 && (
        <Flex direction="row" alignItems="center">
          <Icon svg={<Icons.ArrowDownwardOutline />} color="red-900" />
          <Text size="M" color="red-900">
            {numDecreases}
          </Text>
        </Flex>
      )}
    </Flex>
  );
}
