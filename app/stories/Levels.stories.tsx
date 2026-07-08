import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import type { QueuedToast } from "react-aria-components";

import { Alert, Badge, Flex, Text, Token, View } from "@phoenix/components";
import { Toast } from "@phoenix/components/core/toast";
import type { NotificationParams } from "@phoenix/contexts";

const meta: Meta = {
  title: "Reference/Levels",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

const sectionTitleCSS = css`
  font-size: 14px;
  font-weight: 600;
  color: var(--global-text-color-900);
  margin: 0;
`;

const labelCSS = css`
  font-size: 11px;
  font-weight: 500;
  color: var(--global-text-color-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
`;

const swatchCSS = css`
  width: 20px;
  height: 20px;
  border-radius: var(--global-rounding-small);
  flex-shrink: 0;
`;

const levelRowCSS = css`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

const componentRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const makeToast = (
  key: string,
  variant: NotificationParams["variant"],
  title: string,
  message: string
): QueuedToast<NotificationParams> => ({
  key,
  content: { variant, title, message },
});

type SemanticLevel = {
  name: string;
  cssVar: string;
  badge: { variant: "info" | "success" | "warning" | "danger"; label: string };
  token: { color: string; label: string };
  alert: {
    variant: "info" | "success" | "warning" | "danger";
    message: string;
  };
  toast?: {
    variant: NotificationParams["variant"];
    title: string;
    message: string;
  };
};

const levels: SemanticLevel[] = [
  {
    name: "Info",
    cssVar: "var(--global-color-info)",
    badge: { variant: "info", label: "Active" },
    token: { color: "var(--global-color-info)", label: "Info" },
    alert: { variant: "info", message: "Informational message" },
    toast: undefined,
  },
  {
    name: "Success",
    cssVar: "var(--global-color-success)",
    badge: { variant: "success", label: "Approved" },
    token: { color: "var(--global-color-success)", label: "Success" },
    alert: { variant: "success", message: "Operation completed successfully" },
    toast: {
      variant: "success",
      title: "Success",
      message: "Operation completed",
    },
  },
  {
    name: "Warning",
    cssVar: "var(--global-color-warning)",
    badge: { variant: "warning", label: "Pending" },
    token: { color: "var(--global-color-warning)", label: "Warning" },
    alert: { variant: "warning", message: "Approaching resource limits" },
    toast: undefined,
  },
  {
    name: "Danger",
    cssVar: "var(--global-color-danger)",
    badge: { variant: "danger", label: "Failed" },
    token: { color: "var(--global-color-danger)", label: "Danger" },
    alert: { variant: "danger", message: "Operation failed" },
    toast: { variant: "error", title: "Error", message: "Operation failed" },
  },
];

const Template: StoryFn = () => {
  return (
    <View padding="size-400">
      <Flex direction="column" gap="size-300">
        {levels.map((level) => (
          <div key={level.name} css={levelRowCSS}>
            <Flex direction="row" gap="size-100" alignItems="center">
              <div css={swatchCSS} style={{ backgroundColor: level.cssVar }} />
              <p css={sectionTitleCSS}>{level.name}</p>
              <p css={labelCSS}>--global-color-{level.name.toLowerCase()}</p>
            </Flex>

            <div>
              <p css={labelCSS} style={{ marginBottom: 4 }}>
                Text Color
              </p>
              <Text
                size="L"
                weight="heavy"
                color="inherit"
                elementType="p"
                css={css`
                  color: var(--global-color-${level.name.toLowerCase()});
                `}
              >
                {level.name} heading example
              </Text>
            </div>

            <div css={componentRowCSS}>
              <p css={labelCSS}>Badge</p>
              <Badge variant={level.badge.variant}>{level.badge.label}</Badge>
            </div>

            <div css={componentRowCSS}>
              <p css={labelCSS}>Token</p>
              <Token color={level.token.color}>{level.token.label}</Token>
            </div>

            <div>
              <p css={labelCSS} style={{ marginBottom: 4 }}>
                Alert
              </p>
              <Alert variant={level.alert.variant}>{level.alert.message}</Alert>
            </div>

            {level.toast && (
              <div>
                <p css={labelCSS} style={{ marginBottom: 4 }}>
                  Toast
                </p>
                <Flex maxWidth="400px">
                  <Toast
                    toast={makeToast(
                      level.name.toLowerCase(),
                      level.toast.variant,
                      level.toast.title,
                      level.toast.message
                    )}
                  />
                </Flex>
              </div>
            )}
          </div>
        ))}
      </Flex>
    </View>
  );
};

export const Default = {
  render: Template,
};
