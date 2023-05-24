/**
 * @generated SignedSource<<74e7fed5cd8c39a867075a85a2ca5bff>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DimensionCardinalityStats_dimension$data = {
  readonly cardinality: number | null;
  readonly id: string;
  readonly referenceCardinality?: number | null;
  readonly " $fragmentType": "DimensionCardinalityStats_dimension";
};
export type DimensionCardinalityStats_dimension$key = {
  readonly " $data"?: DimensionCardinalityStats_dimension$data;
  readonly " $fragmentSpreads": FragmentRefs<"DimensionCardinalityStats_dimension">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "kind": "Literal",
  "name": "metric",
  "value": "cardinality"
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "hasReference"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "DimensionCardinalityStats_dimension",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": "cardinality",
      "args": [
        (v0/*: any*/),
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "kind": "ScalarField",
      "name": "dataQualityMetric",
      "storageKey": null
    },
    {
      "condition": "hasReference",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "referenceCardinality",
          "args": [
            {
              "kind": "Literal",
              "name": "datasetRole",
              "value": "reference"
            },
            (v0/*: any*/)
          ],
          "kind": "ScalarField",
          "name": "dataQualityMetric",
          "storageKey": "dataQualityMetric(datasetRole:\"reference\",metric:\"cardinality\")"
        }
      ]
    }
  ],
  "type": "Dimension",
  "abstractKey": null
};
})();

(node as any).hash = "64914c9034900600ea929cfbc657a000";

export default node;
