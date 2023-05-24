/**
 * @generated SignedSource<<875d1834a72e7dae63f462489e145949>>
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
  readonly referencePercentEmpty?: number | null;
  readonly " $fragmentType": "DimensionPercentEmptyStats_dimension";
};
export type DimensionPercentEmptyStats_dimension$key = {
  readonly " $data"?: DimensionPercentEmptyStats_dimension$data;
  readonly " $fragmentSpreads": FragmentRefs<"DimensionPercentEmptyStats_dimension">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "kind": "Literal",
  "name": "metric",
  "value": "percentEmpty"
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
          "alias": "referencePercentEmpty",
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
          "storageKey": "dataQualityMetric(datasetRole:\"reference\",metric:\"percentEmpty\")"
        }
      ]
    }
  ],
  "type": "Dimension",
  "abstractKey": null
};
})();

(node as any).hash = "1c925328033ee2cc2139a0b1f9ab212f";

export default node;
