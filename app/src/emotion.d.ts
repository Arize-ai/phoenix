import "@emotion/react";
import { theme } from "@arizeai/components";

type ACTheme = typeof theme;
declare module "@emotion/react" {
    export interface Theme extends ACTheme {}
}
