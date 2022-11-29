import { css } from "@emotion/css";
import React, { ReactNode } from "react";
import { Text, theme } from "@arizeai/components";

const controlsCSS = css`
    position: absolute;
    &[data-position="top-left"] {
        top: ${theme.spacing.margin8}px;
        left: ${theme.spacing.margin8}px;
    }
    &[data-position="top-right"] {
        top: ${theme.spacing.margin8}px;
        right: ${theme.spacing.margin8}px;
    }
    border-radius: 6px;
    border: 1px solid ${theme.colors.gray200};
    background-color: ${theme.colors.gray400};
    box-shadow: 0 2px 5px 5px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    z-index: 1;
`;

type ControlPosition = "top-left" | "top-right";

/**
 * A relatively positioned panel that floats above a canvas
 * Can be positioned in the corners of the canvas
 */
export function ControlPanel({
    children,
    position = "top-left",
    width,
}: {
    children: ReactNode;
    position?: ControlPosition;
    /**
     * The width of the control panel
     */
    width?: number | string;
}) {
    return (
        <section
            className={controlsCSS}
            data-position={position}
            style={{ width }}
        >
            {children}
        </section>
    );
}

export function ControlPanelHeader({
    children,
    extra,
}: {
    children: ReactNode;
    extra?: ReactNode;
}) {
    return (
        <header
            className={css`
                padding: ${theme.spacing.margin8}px ${theme.spacing.margin16}px;
                border-bottom: 1px solid ${theme.colors.gray500};
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
            `}
        >
            <Text textSize="medium" weight="heavy">
                {children}
            </Text>
            <div>{extra}</div>
        </header>
    );
}
