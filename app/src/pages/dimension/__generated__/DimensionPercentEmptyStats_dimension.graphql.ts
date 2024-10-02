/**
 * @generated SignedSource<<34e084d83b2f0fdd376b9f8cde9b3523>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
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
              "name": "inferencesRole",
              "value": "reference"
            },
            (v0/*: any*/)
          ],
          "kind": "ScalarField",
          "name": "dataQualityMetric",
          "storageKey": "dataQualityMetric(inferencesRole:\"reference\",metric:\"percentEmpty\")"
        }
      ]
    }
  ],
  "type": "Dimension",
  "abstractKey": null
};
})();

(node as any).hash = "1e10d0449d6607d9292f355548c41c78";

export default node;
