/*
 *                    Copyright 2023 Arize AI and contributors.
 *                     Licensed under the Elastic License 2.0;
 *   you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from "react";
import { DriftPointCloud, DriftPointCloudProps } from "../canvas";
import { Widget } from "./Widget";

export type UMAPWidgetProps = DriftPointCloudProps;

export function UMAPWidget(props: UMAPWidgetProps) {
  return (
    <Widget title="UMAP Comparison" collapsible variant="compact">
      <DriftPointCloud {...props} />
    </Widget>
  );
}
