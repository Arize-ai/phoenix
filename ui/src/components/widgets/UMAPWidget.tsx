import React from "react";
import { DriftPointCloud, DriftPointCloudProps } from "../canvas";

export type UMAPWidgetProps = DriftPointCloudProps;

export function UMAPWidget(props: UMAPWidgetProps) {
    return <DriftPointCloud {...props} />;
}
