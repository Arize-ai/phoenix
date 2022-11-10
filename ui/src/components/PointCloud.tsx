import React from "react";
import {
    ThreeDimensionalCanvas,
    ThreeDimensionalControls,
    Points,
    PointBaseProps,
    ThreeDimensionalPoint,
} from "@arizeai/point-cloud";
import { ErrorBoundary } from "./ErrorBoundary";

const data: PointBaseProps[] = Array.from({ length: 10000 }, (_, i) => ({
    position: [
        Math.random(),
        Math.random(),
        Math.random(),
    ] as ThreeDimensionalPoint,
    metaData: {
        id: i,
    },
}));

require("react-dom");

/**
 * Quick and dirty point cloud implementation
 */
export function PointCloud() {
    return (
        <div>
            <ErrorBoundary>
                <ThreeDimensionalCanvas camera={{ position: [0, 0, 10] }}>
                    <ThreeDimensionalControls />
                    <Points data={data} pointProps={{ color: "#7BFFFF" }} />
                </ThreeDimensionalCanvas>
            </ErrorBoundary>
        </div>
    );
}
