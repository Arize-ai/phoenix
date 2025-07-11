import { css } from "@emotion/react";

import { Icon, IconButton, Text, View } from "@phoenix/components";
import * as Icons from "@phoenix/components/icon/Icons";
import { Flex } from "@phoenix/components/layout";

import { BarChart, BarChartProps } from "./BarChart";

export interface ChartCardProps {
  title: string;
  value?: string;
  chart: BarChartProps;
  onMenuClick?: () => void;
}

export function ChartCard({
  title,
  value,
  chart,
  onMenuClick,
}: ChartCardProps) {
  return (
    <div
      css={css`
        background-color: var(--ac-global-background-color-default);
        border: 1px solid var(--ac-global-border-color-default);
        border-radius: var(--ac-global-rounding-medium);
        box-sizing: border-box;
        padding: var(--ac-global-dimension-static-size-300);
      `}
    >
      <Flex justifyContent="space-between" alignItems="center">
        <Text size="L" weight="normal">
          {title}
        </Text>
        <Flex gap="size-100" alignItems="center">
          {value && (
            <Text size="L" weight="heavy">
              {value}
            </Text>
          )}
          {onMenuClick && (
            <IconButton
              size="S"
              aria-label="Chart options"
              onPress={onMenuClick}
            >
              <Icon svg={<Icons.MoreHorizontalOutline />} />
            </IconButton>
          )}
        </Flex>
      </Flex>
      <div
        css={css`
          padding-top: var(--ac-global-dimension-static-size-250);
        `}
      >
        <BarChart {...chart} />
      </div>
    </div>
  );
}
