/**
 * @generated SignedSource<<ca94edce5413eb85684fcc1bc68ea077>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type DimensionType = "actual" | "feature" | "prediction" | "tag";
export type pointCloudStore_eventsQuery$variables = {
  primaryEventIds: ReadonlyArray<string>;
  referenceEventIds: ReadonlyArray<string>;
};
export type pointCloudStore_eventsQuery$data = {
  readonly model: {
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
            readonly id: string;
            readonly name: string;
            readonly type: DimensionType;
          };
          readonly value: string | null;
        }>;
        readonly eventMetadata: {
          readonly actualLabel: string | null;
          readonly actualScore: number | null;
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
export type pointCloudStore_eventsQuery = {
  response: pointCloudStore_eventsQuery$data;
  variables: pointCloudStore_eventsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "primaryEventIds"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "referenceEventIds"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "type",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v5 = {
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
v6 = {
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
},
v7 = [
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
            "selections": [
              (v1/*: any*/),
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
                      (v2/*: any*/),
                      (v3/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v4/*: any*/)
                ],
                "storageKey": null
              },
              (v5/*: any*/),
              (v6/*: any*/)
            ],
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
            "selections": [
              (v1/*: any*/),
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
                      (v1/*: any*/),
                      (v2/*: any*/),
                      (v3/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v4/*: any*/)
                ],
                "storageKey": null
              },
              (v5/*: any*/),
              (v6/*: any*/)
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
    "name": "pointCloudStore_eventsQuery",
    "selections": (v7/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "pointCloudStore_eventsQuery",
    "selections": (v7/*: any*/)
  },
  "params": {
    "cacheID": "03ba803e54bb43ab5c55f352f0428bb6",
    "id": null,
    "metadata": {},
    "name": "pointCloudStore_eventsQuery",
    "operationKind": "query",
    "text": "query pointCloudStore_eventsQuery(\n  $primaryEventIds: [ID!]!\n  $referenceEventIds: [ID!]!\n) {\n  model {\n    primaryDataset {\n      events(eventIds: $primaryEventIds) {\n        id\n        dimensions {\n          dimension {\n            name\n            type\n          }\n          value\n        }\n        eventMetadata {\n          predictionLabel\n          predictionScore\n          actualLabel\n          actualScore\n        }\n        promptAndResponse {\n          prompt\n          response\n        }\n      }\n    }\n    referenceDataset {\n      events(eventIds: $referenceEventIds) {\n        id\n        dimensions {\n          dimension {\n            id\n            name\n            type\n          }\n          value\n        }\n        eventMetadata {\n          predictionLabel\n          predictionScore\n          actualLabel\n          actualScore\n        }\n        promptAndResponse {\n          prompt\n          response\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "99cb985aa2e7342832a9c8ba0189e619";

export default node;
