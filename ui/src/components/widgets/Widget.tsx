import React, { ReactNode } from "react";

export type WidgetProps = { children: ReactNode };

export function Widget(props: WidgetProps) {
    const { children } = props;
    return (
        <section style={{ backgroundColor: "black", width: 500, height: 500 }}>
            {children}
        </section>
    );
}
