import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  Flex,
  Icon,
  Icons,
  LinkButton,
  Text,
  View,
} from "@phoenix/components";

export type ChecklistStep = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  isComplete: boolean;
  cta: { label: string; to: string };
  stat: { label: string; value: string };
};

const rowCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-200);
  transition: border-color 0.15s ease;
`;

const completeRowCSS = css`
  border-color: var(--global-color-green-700);
`;

const iconWrapCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--global-dimension-size-450);
  height: var(--global-dimension-size-450);
  border-radius: var(--global-rounding-small);
  background-color: var(--global-color-gray-100);
  flex: none;
  font-size: var(--global-dimension-size-250);
`;

const completeIconWrapCSS = css`
  color: var(--global-color-green-900);
  background-color: transparent;
`;

/**
 * Presentational list of onboarding steps. Each row derives its state from the
 * `isComplete` flag its parent computed from live data: a completed step shows a
 * green check and its stat; an incomplete step shows a call-to-action link.
 */
export function OnboardingChecklist({ steps }: { steps: ChecklistStep[] }) {
  return (
    <Flex direction="column" gap="size-100">
      {steps.map((step, index) => (
        <ChecklistRow key={step.id} step={step} index={index + 1} />
      ))}
    </Flex>
  );
}

function ChecklistRow({
  step,
  index,
}: {
  step: ChecklistStep;
  index: number;
}) {
  return (
    <div css={[rowCSS, step.isComplete && completeRowCSS]}>
      <Flex direction="row" gap="size-200" alignItems="center">
        <div css={[iconWrapCSS, step.isComplete && completeIconWrapCSS]}>
          {step.isComplete ? (
            <Icon svg={<Icons.CheckmarkCircleFilled />} />
          ) : (
            <Icon svg={step.icon} />
          )}
        </div>
        <Flex direction="column" gap="size-25" flex="1 1 auto">
          <Text weight="heavy">
            {index}. {step.title}
          </Text>
          <Text size="S" color="text-700">
            {step.description}
          </Text>
        </Flex>
        <View flex="none">
          {step.isComplete ? (
            <Flex
              direction="column"
              alignItems="end"
              gap="size-25"
              minWidth="size-1600"
            >
              <Text size="XL" weight="heavy">
                {step.stat.value}
              </Text>
              <Text size="XS" color="text-700">
                {step.stat.label}
              </Text>
            </Flex>
          ) : (
            <LinkButton
              to={step.cta.to}
              size="S"
              variant="primary"
              trailingVisual={<Icon svg={<Icons.ChevronRight />} />}
            >
              {step.cta.label}
            </LinkButton>
          )}
        </View>
      </Flex>
    </div>
  );
}
