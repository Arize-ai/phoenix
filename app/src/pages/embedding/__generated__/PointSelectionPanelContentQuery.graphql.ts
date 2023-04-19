/**
 * @generated SignedSource<<aa31c843d963c0dee7a0e3bcd8fd2ae4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type DimensionType = "actual" | "feature" | "prediction" | "tag";
export type PointSelectionPanelContentQuery$variables = {
  primaryEventIds: ReadonlyArray<string>;
  referenceEventIds: ReadonlyArray<string>;
};
export type PointSelectionPanelContentQuery$data = {
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
          readonly predictionLabel: string | null;
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
          readonly predictionLabel: string | null;
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
v1 = [
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
v2 = [
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
            "selections": (v1/*: any*/),
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
            "selections": (v1/*: any*/),
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
    "name": "PointSelectionPanelContentQuery",
    "selections": (v2/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PointSelectionPanelContentQuery",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "f9e7b91fc6c0556ccfbcd94cc783655e",
    "id": null,
    "metadata": {},
    "name": "PointSelectionPanelContentQuery",
    "operationKind": "query",
    "text": "query PointSelectionPanelContentQuery(\n  $primaryEventIds: [ID!]!\n  $referenceEventIds: [ID!]!\n) {\n  model {\n    primaryDataset {\n      events(eventIds: $primaryEventIds) {\n        id\n        dimensions {\n          dimension {\n            name\n            type\n          }\n          value\n        }\n        eventMetadata {\n          predictionLabel\n          actualLabel\n        }\n        promptAndResponse {\n          prompt\n          response\n        }\n      }\n    }\n    referenceDataset {\n      events(eventIds: $referenceEventIds) {\n        id\n        dimensions {\n          dimension {\n            name\n            type\n          }\n          value\n        }\n        eventMetadata {\n          predictionLabel\n          actualLabel\n        }\n        promptAndResponse {\n          prompt\n          response\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e104d47d175f9301d04a0303e0af2227";

export default node;
