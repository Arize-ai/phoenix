/**
 * @generated SignedSource<<7526da24a440d2ce9da2b170ef14f77c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
export type DimensionType = "actual" | "feature" | "prediction" | "tag";
import { FragmentRefs } from "relay-runtime";
export type MetricSelector_dimensions$data = {
  readonly numericDimensions: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly name: string;
        readonly type: DimensionType;
      };
    }>;
  };
  readonly " $fragmentType": "MetricSelector_dimensions";
};
export type MetricSelector_dimensions$key = {
  readonly " $data"?: MetricSelector_dimensions$data;
  readonly " $fragmentSpreads": FragmentRefs<"MetricSelector_dimensions">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "MetricSelector_dimensions",
  "selections": [
    {
      "alias": "numericDimensions",
      "args": [
        {
          "kind": "Literal",
          "name": "include",
          "value": {
            "dataTypes": [
              "numeric"
            ]
          }
        }
      ],
      "concreteType": "DimensionConnection",
      "kind": "LinkedField",
      "name": "dimensions",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DimensionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "Dimension",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "name",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "type",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "dimensions(include:{\"dataTypes\":[\"numeric\"]})"
    }
  ],
  "type": "Model",
  "abstractKey": null
};

(node as any).hash = "7a65751d40633975d745a92085e0c875";

export default node;
