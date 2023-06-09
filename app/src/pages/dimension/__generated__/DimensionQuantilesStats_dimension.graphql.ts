/**
 * @generated SignedSource<<82b11b8146f286e3f8ebe1ff59537d9f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DimensionQuantilesStats_dimension$data = {
  readonly p1: number | null;
  readonly p25: number | null;
  readonly p50: number | null;
  readonly p75: number | null;
  readonly p99: number | null;
  readonly " $fragmentType": "DimensionQuantilesStats_dimension";
};
export type DimensionQuantilesStats_dimension$key = {
  readonly " $data"?: DimensionQuantilesStats_dimension$data;
  readonly " $fragmentSpreads": FragmentRefs<"DimensionQuantilesStats_dimension">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "DimensionQuantilesStats_dimension",
  "selections": [
    {
      "alias": "p99",
      "args": [
        {
          "kind": "Literal",
          "name": "metric",
          "value": "p99"
        },
        (v0/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "dataQualityMetric",
      "storageKey": null
    },
    {
      "alias": "p75",
      "args": [
        {
          "kind": "Literal",
          "name": "metric",
          "value": "p75"
        },
        (v0/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "dataQualityMetric",
      "storageKey": null
    },
    {
      "alias": "p50",
      "args": [
        {
          "kind": "Literal",
          "name": "metric",
          "value": "p50"
        },
        (v0/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "dataQualityMetric",
      "storageKey": null
    },
    {
      "alias": "p25",
      "args": [
        {
          "kind": "Literal",
          "name": "metric",
          "value": "p25"
        },
        (v0/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "dataQualityMetric",
      "storageKey": null
    },
    {
      "alias": "p1",
      "args": [
        {
          "kind": "Literal",
          "name": "metric",
          "value": "p01"
        },
        (v0/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "dataQualityMetric",
      "storageKey": null
    }
  ],
  "type": "Dimension",
  "abstractKey": null
};
})();

(node as any).hash = "c306c8eafb1d34be464d3a658d5f94a7";

export default node;
