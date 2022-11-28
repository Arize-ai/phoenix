import React, { useMemo, useState } from "react";
import {
    ThreeDimensionalCanvas,
    ThreeDimensionalControls,
    Points,
    getThreeDimensionalBounds,
    ThreeDimensionalPoint,
    ThreeDimensionalBounds,
} from "@arizeai/point-cloud";
import { ErrorBoundary } from "../ErrorBoundary";
import { Radio, RadioGroup, theme } from "@arizeai/components";
import { css } from "@emotion/css";

export type ThreeDimensionalPointItem = {
    position: ThreeDimensionalPoint;
    metaData: any;
};
export type DriftPointCloudProps = {
    primaryData: ThreeDimensionalPointItem[];
    referenceData: ThreeDimensionalPointItem[];
};

function Tools() {
    return (
        <div
            className={css`
                position: absolute;
                left: ${theme.spacing.margin8}px;
                top: ${theme.spacing.margin8}px;
            `}
        >
            <RadioGroup defaultValue="move" variant="inline-button">
                <Radio label="Move" value="move">
                    Move
                </Radio>
                <Radio label="Select" value="select">
                    Select
                </Radio>
            </RadioGroup>
        </div>
    );
}
export function DriftPointCloud({
    primaryData,
    referenceData,
}: DriftPointCloudProps) {
    // AutoRotate the canvas on initial load
    const [autoRotate, setAutoRotate] = useState<boolean>(true);
    const bounds = useMemo(() => {
        return getThreeDimensionalBounds([
            ...primaryData.map((d) => d.position),
            ...referenceData.map((d) => d.position),
        ]);
    }, []);
    return (
        <ErrorBoundary>
            <Tools />
            <ThreeDimensionalCanvas camera={{ position: [0, 0, 10] }}>
                <ThreeDimensionalControls
                    autoRotate={autoRotate}
                    autoRotateSpeed={2}
                    onEnd={() => {
                        // Turn off auto rotate when the user interacts with the canvas
                        setAutoRotate(false);
                    }}
                />
                <ThreeDimensionalBounds bounds={bounds}>
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
