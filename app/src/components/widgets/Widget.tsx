/*
 *                    Copyright 2023 Arize AI and contributors.
 *                     Licensed under the Elastic License 2.0;
 *   you may not use this file except in compliance with the Elastic License 2.0.
 */

import { Card, CardProps } from "@arizeai/components";
import React from "react";

export type WidgetProps = CardProps;

export function Widget({ children, ...props }: WidgetProps) {
  return (
    <Card {...props} bodyStyle={{ padding: 0 }}>
      <section style={{ height: 600, position: "relative" }}>
        {children}
      </section>
    </Card>
  );
}
