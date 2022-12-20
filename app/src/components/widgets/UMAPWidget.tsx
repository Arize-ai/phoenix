import React from "react";
import { DriftPointCloud, DriftPointCloudProps } from "../canvas";
import { Widget } from "./Widget";
import { Item, Radio, RadioGroup } from "@arizeai/components";

export type UMAPWidgetProps = DriftPointCloudProps;

export function UMAPWidget(props: UMAPWidgetProps) {
    return (
        <Widget title="UMAP Comparison" collapsible variant="compact">
            <DriftPointCloud {...props} />
        </Widget>
    );
}
