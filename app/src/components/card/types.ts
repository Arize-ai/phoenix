import { PropsWithChildren } from "react";

import { ViewStyleProps } from "@phoenix/components/types";

export interface CardProps extends PropsWithChildren<ViewStyleProps> {
  title: string;
  subTitle?: string;
  collapsible?: boolean;
  extra?: React.ReactNode;
}
