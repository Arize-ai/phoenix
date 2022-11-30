import React, { ReactNode, useCallback, useMemo, useState } from "react";
import {
    ThreeDimensionalCanvas,
    ThreeDimensionalControls,
    Points,
    getThreeDimensionalBounds,
    ThreeDimensionalPoint,
    ThreeDimensionalBounds,
    LassoSelect,
    PointBaseProps,
} from "@arizeai/point-cloud";
import { ErrorBoundary } from "../ErrorBoundary";
import {
    Accordion,
    AccordionItem,
    Form,
    Icon,
    Icons,
    Item,
    Picker,
    Radio,
    RadioGroup,
    theme,
} from "@arizeai/components";
import { css } from "@emotion/css";
import { shade } from "polished";
import { ControlPanel } from "./ControlPanel";

const DIM_AMOUNT = 0.5;

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
                /* left: ${CONTROL_PANEL_WIDTH +
                2 * theme.spacing.margin8}px; */
                left: ${theme.spacing.margin8}px;
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
                    <Icon svg={<Icons.LassoOutline />} />
                </Radio>
            </RadioGroup>
        </div>
    );
}

function AccordionSection({ children }: { children: ReactNode }) {
    return (
        <section
            className={css`
                margin: ${theme.spacing.margin8};
            `}
        >
            {children}
        </section>
    );
}

function DisplayControlPanel() {
    return (
        <ControlPanel position="top-left" width={CONTROL_PANEL_WIDTH}>
            <Accordion variant="compact">
                <AccordionItem title="Display" id="display">
                    <AccordionSection>
                        <Form>
                            <Picker
                                label="Color by"
                                defaultSelectedKey={"dataset"}
                            >
                                <Item key="dataset">Dataset</Item>
                            </Picker>
                        </Form>
                    </AccordionSection>
                </AccordionItem>
            </Accordion>
        </ControlPanel>
    );
}

function SelectionControlPanel({ selectedIds }: { selectedIds: Set<string> }) {
    return (
        <ControlPanel position="top-right" width={CONTROL_PANEL_WIDTH}>
            <ul>
                {[...selectedIds].map((id) => (
                    <li key={id}>{id}</li>
                ))}
            </ul>
        </ControlPanel>
    );
}

function UMAPPoints({
    primaryData,
    referenceData,
    selectedIds,
}: DriftPointCloudProps & { selectedIds: Set<string> }) {
    const primaryColor = "#7BFFFF";
    const referenceColor = "#d57bff";
    /** Colors to represent a dimmed variant of the color for "un-selected" */
    const dimmedPrimaryColor = useMemo(() => {
        // if (typeof primaryColor === "function") {
        //     return (p: PointBaseProps) => shade(DIM_AMOUNT)(primaryColor(p));
        // }
        return shade(DIM_AMOUNT, primaryColor);
    }, [primaryColor]);

    const dimmedReferenceColor = useMemo(() => {
        // if (typeof referenceColor === "function") {
        //     return (p: PointBaseProps) => shade(DIM_AMOUNT)(referenceColor(p));
        // }
        return shade(DIM_AMOUNT, referenceColor);
    }, [referenceColor]);

    const primaryColorByFn = useCallback(
        (p: PointBaseProps) => {
            if (!selectedIds.has(p.metaData.id) && selectedIds.size > 0) {
                return dimmedPrimaryColor;
            }
            return primaryColor;
        },
        [selectedIds, primaryColor, dimmedPrimaryColor]
    );

    const referenceColorByFn = useCallback(
        (p: PointBaseProps) => {
            if (!selectedIds.has(p.metaData.id) && selectedIds.size > 0) {
                return dimmedReferenceColor;
            }
            return referenceColor;
        },
        [referenceColor, selectedIds, dimmedReferenceColor]
    );

    return (
        <>
            <Points
                data={primaryData}
                pointProps={{ color: primaryColorByFn }}
            />
            <Points
                data={referenceData}
                pointProps={{ color: referenceColorByFn }}
            />
        </>
    );
}

export function DriftPointCloud({
    primaryData,
    referenceData,
}: DriftPointCloudProps) {
    // AutoRotate the canvas on initial load
    const [autoRotate, setAutoRotate] = useState<boolean>(true);
    const [canvasMode, setCanvasMode] = useState<CanvasMode>(CanvasMode.move);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const allPoints = useMemo(() => [...primaryData, ...referenceData], []);
    const bounds = useMemo(() => {
        return getThreeDimensionalBounds(allPoints.map((p) => p.position));
    }, []);
    const isMoveMode = canvasMode === CanvasMode.move;
    return (
        <ErrorBoundary>
            {/* <DisplayControlPanel /> */}
            {/* <SelectionControlPanel selectedIds={selectedIds} /> */}
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
                            setSelectedIds(
                                new Set(selection.map((s) => s.metaData.id))
                            );
                        }}
                        enabled={canvasMode === CanvasMode.select}
                    />

                    <UMAPPoints
                        primaryData={primaryData}
                        referenceData={referenceData}
                        selectedIds={selectedIds}
                    />
                </ThreeDimensionalBounds>
            </ThreeDimensionalCanvas>
        </ErrorBoundary>
    );
}
