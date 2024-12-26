import React, { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { View } from "@arizeai/components";

import { Button, Icon, Icons } from "@phoenix/components";
import { useTheme } from "@phoenix/contexts";

export function ThemeToggleWrap({ children }: PropsWithChildren) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      css={css`
        position: relative;
        .theme-toggle {
          position: absolute;
          right: 8px;
          top: 8px;
          z-index: 100;
        }
      `}
    >
      <Button
        className="theme-toggle"
        onPress={() => setTheme(theme === "light" ? "dark" : "light")}
        icon={
          <Icon
            svg={
              theme === "dark" ? <Icons.SunOutline /> : <Icons.MoonOutline />
            }
          />
        }
      ></Button>

      <View backgroundColor="grey-75" padding="size-300">
        {children}
      </View>
    </div>
  );
}
