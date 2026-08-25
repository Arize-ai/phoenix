import { css } from "@emotion/react";

import { Card, Switch, Text, View } from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

const settingRowCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-primary);
`;

const settingSwitchCSS = css`
  width: 100%;
  box-sizing: border-box;
  white-space: normal;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--global-dimension-size-150);
  gap: var(--global-dimension-size-200);

  .accessibility-setting__label {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }
`;

export function ProfileAccessibilityPage() {
  const isNativeScrollbarStylingEnabled = usePreferencesContext(
    (state) => state.isNativeScrollbarStylingEnabled
  );
  const setIsNativeScrollbarStylingEnabled = usePreferencesContext(
    (state) => state.setIsNativeScrollbarStylingEnabled
  );

  return (
    <Card title="Accessibility">
      <View padding="size-200">
        <div css={settingRowCSS}>
          <Switch
            labelPlacement="start"
            isSelected={isNativeScrollbarStylingEnabled}
            onChange={setIsNativeScrollbarStylingEnabled}
            css={settingSwitchCSS}
          >
            <span className="accessibility-setting__label">
              <Text weight="heavy">Native scrollbars</Text>
              <Text color="text-500" size="S">
                Use your browser and operating system&apos;s default scrollbar
                appearance instead of Phoenix&apos;s minimal style.
              </Text>
            </span>
          </Switch>
        </div>
      </View>
    </Card>
  );
}
