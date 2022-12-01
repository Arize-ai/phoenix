import { theme } from "@arizeai/components";
import { css } from "@emotion/css";
import React, { ReactNode } from "react";

/**
 * A component that renders a layout that's appropriate for a notebook
 * E.g. provides sufficient margin and padding
 */
export function NotebookLayout({ children }: { children: ReactNode }) {
    return (
        <main
            className={css`
                margin: ${theme.spacing.margin16}px;
            `}
        >
            {children}
        </main>
    );
}
