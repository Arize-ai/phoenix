import React, { ReactNode } from "react";

export type WidgetProps = { children: ReactNode };

export function Widget(props: WidgetProps) {
    const { children } = props;
    return (
        <section style={{ backgroundColor: "#131313", height: 900 }}>
            {children}
        </section>
    );
}
