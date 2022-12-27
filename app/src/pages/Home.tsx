import { css } from "@emotion/react";
import { Card } from "@arizeai/components";
import React from "react";

export function Home() {
    return (
        <main
            css={(theme) =>
                css`
                    margin: ${theme.spacing.margin8}px;
                `
            }
        >
            <Card title="Model Schema" variant="compact">
                Schema here
            </Card>
        </main>
    );
}
