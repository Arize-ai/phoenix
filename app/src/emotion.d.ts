import "@emotion/react";
import { theme } from "@arizeai/components";

type ACTheme = typeof theme;
declare module "@emotion/react" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Theme extends ACTheme {}
}
