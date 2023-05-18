/**
 * @generated SignedSource<<ae089f7906c7774b11bb8fab6f9d7c81>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DimensionSegmentsBarChart_dimension$data = {
  readonly id: string;
  readonly segmentsComparison: {
    readonly segments: ReadonlyArray<{
      readonly bin: {
        readonly __typename: "IntervalBin";
        readonly range: {
          readonly end: number;
          readonly start: number;
        };
      } | {
        readonly __typename: "MissingValueBin";
      } | {
        readonly __typename: "NominalBin";
        readonly name: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      };
      readonly counts: {
        readonly primaryValue: number | null;
      };
    }>;
    readonly totalCounts: {
      readonly primaryValue: number | null;
    };
  };
  readonly " $fragmentType": "DimensionSegmentsBarChart_dimension";
};
export type DimensionSegmentsBarChart_dimension$key = {
  readonly " $data"?: DimensionSegmentsBarChart_dimension$data;
  readonly " $fragmentSpreads": FragmentRefs<"DimensionSegmentsBarChart_dimension">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v1 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "primaryValue",
    "storageKey": null
  }
];
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
  "name": "DimensionSegmentsBarChart_dimension",
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
      "args": [
        {
          "kind": "Variable",
          "name": "primaryTimeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "Segments",
      "kind": "LinkedField",
      "name": "segmentsComparison",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "Segment",
          "kind": "LinkedField",
          "name": "segments",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "bin",
              "plural": false,
              "selections": [
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v0/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "name",
                      "storageKey": null
                    }
                  ],
                  "type": "NominalBin",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v0/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "NumericRange",
                      "kind": "LinkedField",
                      "name": "range",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "start",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "end",
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "type": "IntervalBin",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v0/*: any*/)
                  ],
                  "type": "MissingValueBin",
                  "abstractKey": null
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "DatasetValues",
              "kind": "LinkedField",
              "name": "counts",
              "plural": false,
              "selections": (v1/*: any*/),
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetValues",
          "kind": "LinkedField",
          "name": "totalCounts",
          "plural": false,
          "selections": (v1/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Dimension",
  "abstractKey": null
};
})();

(node as any).hash = "8cef9841e9a5bd7d0d50acb5db9028b0";

export default node;
