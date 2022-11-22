import { Card } from "@arizeai/components";
import React, { ReactNode } from "react";

export type WidgetProps = { children: ReactNode };

export function Widget(props: WidgetProps) {
    const { children } = props;
    return (
        <Card title="Widget">
            <section style={{ height: 900 }}>{children}</section>
        </Card>
    );
}
