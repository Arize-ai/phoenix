/**
 * @generated SignedSource<<9160b4413f627bfd72aea71f3de41439>>
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
        readonly id: string;
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
                  "name": "id",
                  "storageKey": null
                },
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

(node as any).hash = "55d03de16503d7af254c17cef7d18ee0";

export default node;
