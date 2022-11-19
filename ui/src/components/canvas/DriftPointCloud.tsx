import React from "react";
import {
    ThreeDimensionalCanvas,
    ThreeDimensionalControls,
    Points,
    PointsProps,
} from "@arizeai/point-cloud";
import { ErrorBoundary } from "../ErrorBoundary";

export type DriftPointCloudProps = {
    primaryData: PointsProps["data"];
    referenceData: PointsProps["data"];
};

export function DriftPointCloud({
    primaryData,
    referenceData,
}: DriftPointCloudProps) {
    return (
        <ErrorBoundary>
            <ThreeDimensionalCanvas camera={{ position: [0, 0, 10] }}>
                <ThreeDimensionalControls />
                <Points data={primaryData} pointProps={{ color: "#7BFFFF" }} />
                <Points
                    data={referenceData}
                    pointProps={{ color: "#d57bff" }}
                />
            </ThreeDimensionalCanvas>
        </ErrorBoundary>
    );
}
