/**
 * @generated SignedSource<<80f8d31eb805e9390bf5888c12a5ba80>>
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
  readonly " $fragmentType": "DimensionCardinalityStats_dimension";
};
export type DimensionCardinalityStats_dimension$key = {
  readonly " $data"?: DimensionCardinalityStats_dimension$data;
  readonly " $fragmentSpreads": FragmentRefs<"DimensionCardinalityStats_dimension">;
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
        {
          "kind": "Literal",
          "name": "metric",
          "value": "cardinality"
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

(node as any).hash = "8e8d84d4db09851503d43ce938c21c86";

export default node;
