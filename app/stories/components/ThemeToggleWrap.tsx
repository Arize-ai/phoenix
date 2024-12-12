import React, { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { Button, Icon, Icons, View } from "@arizeai/components";

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
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        variant="default"
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
