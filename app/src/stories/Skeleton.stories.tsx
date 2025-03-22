import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Flex, Skeleton, Text } from "@phoenix/components";

const meta: Meta<typeof Skeleton> = {
  title: "Components/Skeleton",
  component: Skeleton,
  parameters: {
    layout: "centered",
  },
  args: {
    width: 200,
    height: 50,
    borderRadius: "M",
    animation: "pulse",
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {};

export const BorderRadiusTokens: Story = {
  render: () => (
    <Flex direction="column" gap="size-200">
      <Flex direction="row" gap="size-100" alignItems="center">
        <Text weight="heavy" width={100}>
          None:
        </Text>
        <Skeleton width={200} height={50} borderRadius="none" />
      </Flex>
      <Flex direction="row" gap="size-100" alignItems="center">
        <Text weight="heavy" width={100}>
          Small:
        </Text>
        <Skeleton width={200} height={50} borderRadius="S" />
      </Flex>
      <Flex direction="row" gap="size-100" alignItems="center">
        <Text weight="heavy" width={100}>
          Medium:
        </Text>
        <Skeleton width={200} height={50} borderRadius="M" />
      </Flex>
      <Flex direction="row" gap="size-100" alignItems="center">
        <Text weight="heavy" width={100}>
          Large:
        </Text>
        <Skeleton width={200} height={50} borderRadius="L" />
      </Flex>
      <Flex direction="row" gap="size-100" alignItems="center">
        <Text weight="heavy" width={100}>
          Circle:
        </Text>
        <Skeleton width={100} height={100} borderRadius="circle" />
      </Flex>
    </Flex>
  ),
};

export const TextBlock: Story = {
  render: () => (
    <Flex direction="column" gap="size-100" width="300px">
      <Skeleton height={24} borderRadius="M" />
      <Skeleton height={24} borderRadius="M" />
      <Skeleton height={24} width="60%" borderRadius="M" />
    </Flex>
  ),
};

export const Card: Story = {
  render: () => (
    <Flex direction="column" gap="size-100" width="300px">
      <Skeleton height={200} borderRadius="L" />
      <Skeleton height={24} width="80%" borderRadius="M" />
      <Skeleton height={16} width="60%" borderRadius="M" />
    </Flex>
  ),
};

export const Animations: Story = {
  render: () => (
    <Flex direction="column" gap="size-200">
      <Flex direction="row" gap="size-100" alignItems="center">
        <Text weight="heavy" width={100}>
          Pulse:
        </Text>
        <Skeleton width={200} height={50} animation="pulse" />
      </Flex>
      <Flex direction="row" gap="size-100" alignItems="center">
        <Text weight="heavy" width={100}>
          Wave:
        </Text>
        <Skeleton width={200} height={50} animation="wave" />
      </Flex>
      <Flex direction="row" gap="size-100" alignItems="center">
        <Text weight="heavy" width={100}>
          None:
        </Text>
        <Skeleton width={200} height={50} animation={false} />
      </Flex>
    </Flex>
  ),
};

export const AnimatedCard: Story = {
  render: () => (
    <Flex direction="column" gap="size-100" width="300px">
      <Skeleton height={200} borderRadius="L" animation="wave" />
      <Skeleton height={24} width="80%" borderRadius="M" animation="wave" />
      <Skeleton height={16} width="60%" borderRadius="M" animation="wave" />
    </Flex>
  ),
};

export const WaveAnimationVariants: Story = {
  render: () => (
    <Flex direction="column" gap="size-200">
      {/* Different sizes */}
      <Flex direction="column" gap="size-100">
        <Text weight="heavy">Different sizes:</Text>
        <Skeleton width={300} height={20} animation="wave" />
        <Skeleton width={200} height={20} animation="wave" />
        <Skeleton width={100} height={20} animation="wave" />
      </Flex>

      {/* Different border radius */}
      <Flex direction="column" gap="size-100">
        <Text weight="heavy">Different border radius:</Text>
        <Skeleton
          width={200}
          height={50}
          animation="wave"
          borderRadius="none"
        />
        <Skeleton width={200} height={50} animation="wave" borderRadius="L" />
        <Skeleton
          width={100}
          height={100}
          animation="wave"
          borderRadius="circle"
        />
      </Flex>

      {/* Chat message loading */}
      <Flex direction="column" gap="size-100">
        <Text weight="heavy">Chat message loading:</Text>
        <Flex direction="column" gap="size-100" width={300}>
          <Skeleton width="80%" height={24} animation="wave" />
          <Skeleton width="60%" height={24} animation="wave" />
          <Skeleton width="90%" height={24} animation="wave" />
        </Flex>
      </Flex>

      {/* Profile card loading */}
      <Flex direction="column" gap="size-100">
        <Text weight="heavy">Profile card loading:</Text>
        <Flex direction="row" gap="size-200" alignItems="center">
          <Skeleton
            width={60}
            height={60}
            animation="wave"
            borderRadius="circle"
          />
          <Flex direction="column" gap="size-100" flex={1}>
            <Skeleton width="40%" height={24} animation="wave" />
            <Skeleton width="80%" height={16} animation="wave" />
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  ),
};

export const WaveAnimationList: Story = {
  render: () => (
    <Flex direction="column" gap="size-100" width={400}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Flex key={index} direction="row" gap="size-200" alignItems="center">
          <Skeleton
            width={40}
            height={40}
            animation="wave"
            borderRadius="circle"
          />
          <Flex direction="column" gap="size-100" flex={1}>
            <Skeleton width="70%" height={16} animation="wave" />
            <Skeleton width="40%" height={12} animation="wave" />
          </Flex>
        </Flex>
      ))}
    </Flex>
  ),
};
