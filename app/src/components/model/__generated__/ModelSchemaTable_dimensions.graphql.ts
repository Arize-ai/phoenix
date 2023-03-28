/**
 * @generated SignedSource<<682754976848d752f8722dd93aaa81d1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
export type DimensionDataType = "categorical" | "numeric";
export type DimensionType = "actual" | "feature" | "prediction" | "tag";
import { FragmentRefs } from "relay-runtime";
export type ModelSchemaTable_dimensions$data = {
  readonly model: {
    readonly dimensions: {
      readonly edges: ReadonlyArray<{
        readonly dimension: {
          readonly cardinality: number | null;
          readonly dataType: DimensionDataType;
          readonly max: number | null;
          readonly mean: number | null;
          readonly min: number | null;
          readonly name: string;
          readonly percentEmpty: number | null;
          readonly psi: number | null;
          readonly type: DimensionType;
        };
      }>;
    };
  };
  readonly " $fragmentType": "ModelSchemaTable_dimensions";
};
export type ModelSchemaTable_dimensions$key = {
  readonly " $data"?: ModelSchemaTable_dimensions$data;
  readonly " $fragmentSpreads": FragmentRefs<"ModelSchemaTable_dimensions">;
};

const node: ReaderFragment = (function(){
var v0 = [
  "model",
  "dimensions"
],
v1 = {
  "fields": [
    {
      "kind": "Variable",
      "name": "end",
      "variableName": "endTime"
    },
    {
      "kind": "Variable",
      "name": "start",
      "variableName": "startTime"
    }
  ],
  "kind": "ObjectValue",
  "name": "timeRange"
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": 50,
      "kind": "LocalArgument",
      "name": "count"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "cursor"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "endTime"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "startTime"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "count",
        "cursor": "cursor",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "count",
          "cursor": "cursor"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [],
      "operation": require('./ModelSchemaTableDimensionsQuery.graphql')
    }
  },
  "name": "ModelSchemaTable_dimensions",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Model",
      "kind": "LinkedField",
      "name": "model",
      "plural": false,
      "selections": [
        {
          "alias": "dimensions",
          "args": null,
          "concreteType": "DimensionConnection",
          "kind": "LinkedField",
          "name": "__ModelSchemaTable_dimensions_connection",
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
                  "alias": "dimension",
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
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "dataType",
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
                        (v1/*: any*/)
                      ],
                      "kind": "ScalarField",
                      "name": "dataQualityMetric",
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
                        (v1/*: any*/)
                      ],
                      "kind": "ScalarField",
                      "name": "dataQualityMetric",
                      "storageKey": null
                    },
                    {
                      "alias": "min",
                      "args": [
                        {
                          "kind": "Literal",
                          "name": "metric",
                          "value": "min"
                        },
                        (v1/*: any*/)
                      ],
                      "kind": "ScalarField",
                      "name": "dataQualityMetric",
                      "storageKey": null
                    },
                    {
                      "alias": "mean",
                      "args": [
                        {
                          "kind": "Literal",
                          "name": "metric",
                          "value": "mean"
                        },
                        (v1/*: any*/)
                      ],
                      "kind": "ScalarField",
                      "name": "dataQualityMetric",
                      "storageKey": null
                    },
                    {
                      "alias": "max",
                      "args": [
                        {
                          "kind": "Literal",
                          "name": "metric",
                          "value": "max"
                        },
                        (v1/*: any*/)
                      ],
                      "kind": "ScalarField",
                      "name": "dataQualityMetric",
                      "storageKey": null
                    },
                    {
                      "alias": "psi",
                      "args": [
                        {
                          "kind": "Literal",
                          "name": "metric",
                          "value": "psi"
                        },
                        (v1/*: any*/)
                      ],
                      "kind": "ScalarField",
                      "name": "driftMetric",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "cursor",
                  "storageKey": null
                },
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
                      "name": "__typename",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "PageInfo",
              "kind": "LinkedField",
              "name": "pageInfo",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "endCursor",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "hasNextPage",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "567dde6bbe888ee7145eccaa57766d2b";

export default node;
