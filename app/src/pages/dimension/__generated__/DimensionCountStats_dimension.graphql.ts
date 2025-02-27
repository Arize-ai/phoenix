/**
 * @generated SignedSource<<a35a69be7743f3be46d55a6554634a5b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DimensionCountStats_dimension$data = {
  readonly count: number | null;
  readonly id: string;
  readonly " $fragmentType": "DimensionCountStats_dimension";
};
export type DimensionCountStats_dimension$key = {
  readonly " $data"?: DimensionCountStats_dimension$data;
  readonly " $fragmentSpreads": FragmentRefs<"DimensionCountStats_dimension">;
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
  "name": "DimensionCountStats_dimension",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": "count",
      "args": [
        {
          "kind": "Literal",
          "name": "metric",
          "value": "count"
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

(node as any).hash = "6dccac51f3fb0853276677c692af5a43";

export default node;
