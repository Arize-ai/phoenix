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
