/**
 * @generated SignedSource<<b83e2946ccf3e49540aaf5a1960f0b57>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DimensionPercentEmptyStats_dimension$data = {
  readonly id: string;
  readonly percentEmpty: number | null;
  readonly " $fragmentType": "DimensionPercentEmptyStats_dimension";
};
export type DimensionPercentEmptyStats_dimension$key = {
  readonly " $data"?: DimensionPercentEmptyStats_dimension$data;
  readonly " $fragmentSpreads": FragmentRefs<"DimensionPercentEmptyStats_dimension">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "DimensionPercentEmptyStats_dimension",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": "percentEmpty",
      "args": [
        {
          "kind": "Literal",
          "name": "metric",
          "value": "percentEmpty"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "kind": "ScalarField",
      "name": "dataQualityMetric",
      "storageKey": null
    }
  ],
  "type": "Dimension",
  "abstractKey": null
};

(node as any).hash = "31b713b70c46afb60af27a1e0b0b453e";

export default node;
