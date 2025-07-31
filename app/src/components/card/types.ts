import { PropsWithChildren } from "react";

import { ViewStyleProps } from "@phoenix/components/types";

export interface CardProps extends PropsWithChildren<ViewStyleProps> {
  title?: string | React.ReactNode;
  titleExtra?: React.ReactNode;
  subTitle?: string;
  collapsible?: boolean;
  extra?: React.ReactNode;
}
