import React, { useMemo, useState } from "react";
import {
    ThreeDimensionalCanvas,
    ThreeDimensionalControls,
    Points,
    getThreeDimensionalBounds,
    ThreeDimensionalPoint,
    ThreeDimensionalBounds,
    LassoSelect,
} from "@arizeai/point-cloud";
import { ErrorBoundary } from "../ErrorBoundary";
import {
    Accordion,
    AccordionItem,
    Icon,
    Icons,
    Radio,
    RadioGroup,
    theme,
} from "@arizeai/components";
import { css } from "@emotion/css";
import { ControlPanel } from "./ControlPanel";

export type ThreeDimensionalPointItem = {
    position: ThreeDimensionalPoint;
    metaData: any;
};

export type DriftPointCloudProps = {
    primaryData: ThreeDimensionalPointItem[];
    referenceData: ThreeDimensionalPointItem[];
};

enum CanvasMode {
    move = "move",
    select = "select",
}

/**
 * TypeGuard for the canvas mode
 */
function isCanvasMode(m: unknown): m is CanvasMode {
    return typeof m === "string" && m in CanvasMode;
}

const CONTROL_PANEL_WIDTH = 300;
/**
 * Displays the tools available on the point cloud
 * E.g. move vs select
 */
function CanvasTools(props: {
    mode: CanvasMode;
    onChange: (mode: CanvasMode) => void;
}) {
    return (
        <div
            className={css`
                position: absolute;
                left: ${CONTROL_PANEL_WIDTH + 2 * theme.spacing.margin8}px;
                top: ${theme.spacing.margin8}px;
                z-index: 1;
            `}
        >
            <RadioGroup
                defaultValue={props.mode}
                variant="inline-button"
                size="compact"
                onChange={(v) => {
                    if (isCanvasMode(v)) {
                        props.onChange(v);
                    } else {
                        throw new Error(`Unknown canvas mode: ${v}`);
                    }
                }}
            >
                <Radio label="Move" value={CanvasMode.move}>
                    <Icon svg={<Icons.MoveFilled />} />
                </Radio>
                <Radio label="Select" value={CanvasMode.select}>
                    <Icon svg={<Icons.PlusCircleOutline />} />
                </Radio>
            </RadioGroup>
        </div>
    );
}

function DisplayControlPanel() {
    return (
        <ControlPanel position="top-left" width={CONTROL_PANEL_WIDTH}>
            <Accordion variant="compact">
                <AccordionItem title="Display" id="display">
                    {"Display"}
                </AccordionItem>
                <AccordionItem title="Cluster" id="clusters">
                    {"Clusters"}
                </AccordionItem>
            </Accordion>
        </ControlPanel>
    );
}

export function DriftPointCloud({
    primaryData,
    referenceData,
}: DriftPointCloudProps) {
    // AutoRotate the canvas on initial load
    const [autoRotate, setAutoRotate] = useState<boolean>(true);
    const [canvasMode, setCanvasMode] = useState<CanvasMode>(CanvasMode.move);
    const allPoints = useMemo(() => [...primaryData, ...referenceData], []);
    const bounds = useMemo(() => {
        return getThreeDimensionalBounds(allPoints.map((p) => p.position));
    }, []);
    const isMoveMode = canvasMode === CanvasMode.move;
    return (
        <ErrorBoundary>
            <DisplayControlPanel />
            <CanvasTools mode={canvasMode} onChange={setCanvasMode} />
            <ThreeDimensionalCanvas camera={{ position: [0, 0, 10] }}>
                <ThreeDimensionalControls
                    autoRotate={autoRotate}
                    autoRotateSpeed={2}
                    enableRotate={isMoveMode}
                    enablePan={isMoveMode}
                    onEnd={() => {
                        // Turn off auto rotate when the user interacts with the canvas
                        setAutoRotate(false);
                    }}
                />
                <ThreeDimensionalBounds bounds={bounds}>
                    <LassoSelect
                        points={allPoints}
                        onChange={(selection) => {
                            // setSelectedUuids(
                            //     new Set(selection.map((s) => s.metaData.uuid))
                            // );
                        }}
                        enabled={canvasMode === CanvasMode.select}
                    />
                    <Points
                        data={primaryData}
                        pointProps={{ color: "#7BFFFF" }}
                    />
                    <Points
                        data={referenceData}
                        pointProps={{ color: "#d57bff" }}
                    />
                </ThreeDimensionalBounds>
            </ThreeDimensionalCanvas>
        </ErrorBoundary>
    );
}
