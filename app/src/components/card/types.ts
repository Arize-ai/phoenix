import { PropsWithChildren } from "react";

import { ViewStyleProps } from "@phoenix/components/types";

export type CardVariant = "default" | "compact";

export interface CardProps extends PropsWithChildren<ViewStyleProps> {
  title: string;
  subTitle?: string;
  variant?: CardVariant;
  collapsible?: boolean;
  bodyStyle?: ViewStyleProps;
  extra?: React.ReactNode;
}
