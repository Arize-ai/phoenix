import React, { PropsWithChildren } from "react";

import { ThemeToggleWrap } from "./ThemeToggleWrap";

export function ThemeSplitView({ children }: PropsWithChildren) {
  return (
    <>
      <ThemeToggleWrap key="dark">{children}</ThemeToggleWrap>
      <ThemeToggleWrap key="light">{children}</ThemeToggleWrap>
    </>
  );
}
