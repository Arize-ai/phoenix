import React, { PropsWithChildren } from "react";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";

import { Provider, theme } from "@arizeai/components";

import { ThemeProvider, useTheme } from "@phoenix/contexts";
import { GlobalStyles } from "@phoenix/GlobalStyles";

import { ThemeToggleWrap } from "./ThemeToggleWrap";

function ThemeWrapperContent({ children }: PropsWithChildren) {
  const { theme: componentsTheme } = useTheme();
  return (
    <Provider theme={componentsTheme}>
      <EmotionThemeProvider theme={theme}>
        <GlobalStyles />
        <ThemeToggleWrap>{children}</ThemeToggleWrap>
      </EmotionThemeProvider>
    </Provider>
  );
}

export function ThemeWrapper({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <ThemeWrapperContent>{children}</ThemeWrapperContent>
    </ThemeProvider>
  );
}
