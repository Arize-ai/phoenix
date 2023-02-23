/**
 * @generated SignedSource<<0a113ed594c1ad4b33b192ad4ad730d9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type DimensionType = "actual" | "feature" | "prediction" | "tag";
export type EmbeddingSelectionPanelContentQuery$variables = {
  eventIds: ReadonlyArray<string>;
};
export type EmbeddingSelectionPanelContentQuery$data = {
  readonly model: {
    readonly primaryDataset: {
      readonly events: ReadonlyArray<{
        readonly dimensions: ReadonlyArray<{
          readonly dimension: {
            readonly name: string;
            readonly type: DimensionType;
          };
          readonly value: string;
        }>;
        readonly eventMetadata: {
          readonly actualLabel: string | null;
          readonly predictionLabel: string | null;
        };
      }>;
    };
  };
};
export type EmbeddingSelectionPanelContentQuery = {
  response: EmbeddingSelectionPanelContentQuery$data;
  variables: EmbeddingSelectionPanelContentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "eventIds"
  }
],
v1 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "Model",
    "kind": "LinkedField",
    "name": "model",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Dataset",
        "kind": "LinkedField",
        "name": "primaryDataset",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": [
              {
                "kind": "Variable",
                "name": "eventIds",
                "variableName": "eventIds"
              }
            ],
            "concreteType": "Event",
            "kind": "LinkedField",
            "name": "events",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DimensionWithValue",
                "kind": "LinkedField",
                "name": "dimensions",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Dimension",
                    "kind": "LinkedField",
                    "name": "dimension",
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
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "value",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "EventMetadata",
                "kind": "LinkedField",
                "name": "eventMetadata",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "predictionLabel",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "actualLabel",
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
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EmbeddingSelectionPanelContentQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EmbeddingSelectionPanelContentQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "4d6471efc00d831a5520cd03a8ecf556",
    "id": null,
    "metadata": {},
    "name": "EmbeddingSelectionPanelContentQuery",
    "operationKind": "query",
    "text": "query EmbeddingSelectionPanelContentQuery(\n  $eventIds: [ID!]!\n) {\n  model {\n    primaryDataset {\n      events(eventIds: $eventIds) {\n        dimensions {\n          dimension {\n            name\n            type\n          }\n          value\n        }\n        eventMetadata {\n          predictionLabel\n          actualLabel\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "464586ee8f03a2388c73949e4e988db8";

export default node;
