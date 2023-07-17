/**
 * @generated SignedSource<<b4ebbcf5c13083716335ee69dc54a58a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type DimensionType = "actual" | "feature" | "prediction" | "tag";
export type PointSelectionPanelContentQuery$variables = {
  corpusEventIds: ReadonlyArray<string>;
  primaryEventIds: ReadonlyArray<string>;
  referenceEventIds: ReadonlyArray<string>;
};
export type PointSelectionPanelContentQuery$data = {
  readonly model: {
    readonly corpusDataset: {
      readonly events: ReadonlyArray<{
        readonly dimensions: ReadonlyArray<{
          readonly dimension: {
            readonly name: string;
            readonly type: DimensionType;
          };
          readonly value: string | null;
        }>;
        readonly eventMetadata: {
          readonly actualLabel: string | null;
          readonly actualScore: number | null;
          readonly predictionId: string | null;
          readonly predictionLabel: string | null;
          readonly predictionScore: number | null;
        };
        readonly id: string;
        readonly promptAndResponse: {
          readonly prompt: string | null;
          readonly response: string | null;
        } | null;
      }>;
    } | null;
    readonly primaryDataset: {
      readonly events: ReadonlyArray<{
        readonly dimensions: ReadonlyArray<{
          readonly dimension: {
            readonly name: string;
            readonly type: DimensionType;
          };
          readonly value: string | null;
        }>;
        readonly eventMetadata: {
          readonly actualLabel: string | null;
          readonly actualScore: number | null;
          readonly predictionId: string | null;
          readonly predictionLabel: string | null;
          readonly predictionScore: number | null;
        };
        readonly id: string;
        readonly promptAndResponse: {
          readonly prompt: string | null;
          readonly response: string | null;
        } | null;
      }>;
    };
    readonly referenceDataset: {
      readonly events: ReadonlyArray<{
        readonly dimensions: ReadonlyArray<{
          readonly dimension: {
            readonly name: string;
            readonly type: DimensionType;
          };
          readonly value: string | null;
        }>;
        readonly eventMetadata: {
          readonly actualLabel: string | null;
          readonly actualScore: number | null;
          readonly predictionId: string | null;
          readonly predictionLabel: string | null;
          readonly predictionScore: number | null;
        };
        readonly id: string;
        readonly promptAndResponse: {
          readonly prompt: string | null;
          readonly response: string | null;
        } | null;
      }>;
    } | null;
  };
};
export type PointSelectionPanelContentQuery = {
  response: PointSelectionPanelContentQuery$data;
  variables: PointSelectionPanelContentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "corpusEventIds"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "primaryEventIds"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "referenceEventIds"
},
v3 = [
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
        "name": "predictionId",
        "storageKey": null
      },
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
        "name": "predictionScore",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "actualLabel",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "actualScore",
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "PromptResponse",
    "kind": "LinkedField",
    "name": "promptAndResponse",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "prompt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "response",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v4 = [
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
                "variableName": "primaryEventIds"
              }
            ],
            "concreteType": "Event",
            "kind": "LinkedField",
            "name": "events",
            "plural": true,
            "selections": (v3/*: any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Dataset",
        "kind": "LinkedField",
        "name": "referenceDataset",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": [
              {
                "kind": "Variable",
                "name": "eventIds",
                "variableName": "referenceEventIds"
              }
            ],
            "concreteType": "Event",
            "kind": "LinkedField",
            "name": "events",
            "plural": true,
            "selections": (v3/*: any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Dataset",
        "kind": "LinkedField",
        "name": "corpusDataset",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": [
              {
                "kind": "Variable",
                "name": "eventIds",
                "variableName": "corpusEventIds"
              }
            ],
            "concreteType": "Event",
            "kind": "LinkedField",
            "name": "events",
            "plural": true,
            "selections": (v3/*: any*/),
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "PointSelectionPanelContentQuery",
    "selections": (v4/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "PointSelectionPanelContentQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "d51bd68003fc2d6e20e553b8f10f2201",
    "id": null,
    "metadata": {},
    "name": "PointSelectionPanelContentQuery",
    "operationKind": "query",
    "text": "query PointSelectionPanelContentQuery(\n  $primaryEventIds: [ID!]!\n  $referenceEventIds: [ID!]!\n  $corpusEventIds: [ID!]!\n) {\n  model {\n    primaryDataset {\n      events(eventIds: $primaryEventIds) {\n        id\n        dimensions {\n          dimension {\n            name\n            type\n          }\n          value\n        }\n        eventMetadata {\n          predictionId\n          predictionLabel\n          predictionScore\n          actualLabel\n          actualScore\n        }\n        promptAndResponse {\n          prompt\n          response\n        }\n      }\n    }\n    referenceDataset {\n      events(eventIds: $referenceEventIds) {\n        id\n        dimensions {\n          dimension {\n            name\n            type\n          }\n          value\n        }\n        eventMetadata {\n          predictionId\n          predictionLabel\n          predictionScore\n          actualLabel\n          actualScore\n        }\n        promptAndResponse {\n          prompt\n          response\n        }\n      }\n    }\n    corpusDataset {\n      events(eventIds: $corpusEventIds) {\n        id\n        dimensions {\n          dimension {\n            name\n            type\n          }\n          value\n        }\n        eventMetadata {\n          predictionId\n          predictionLabel\n          predictionScore\n          actualLabel\n          actualScore\n        }\n        promptAndResponse {\n          prompt\n          response\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e1a49c005ff2dd1ad7486f1170526095";

export default node;
