/**
 * @generated SignedSource<<153355ed9f88bcc1dcef6a3291a1659f>>
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
          readonly value: string;
        }>;
        readonly eventMetadata: {
          readonly actualLabel: string | null;
          readonly predictionLabel: string | null;
        };
      }>;
    };
    readonly referenceDataset: {
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
    "cacheID": "f6adb3e543f43f69eff7bf548ec1c139",
    "id": null,
    "metadata": {},
    "name": "PointSelectionPanelContentQuery",
    "operationKind": "query",
    "text": "query PointSelectionPanelContentQuery(\n  $primaryEventIds: [ID!]!\n  $referenceEventIds: [ID!]!\n) {\n  model {\n    primaryDataset {\n      events(eventIds: $primaryEventIds) {\n        dimensions {\n          dimension {\n            name\n            type\n          }\n          value\n        }\n        eventMetadata {\n          predictionLabel\n          actualLabel\n        }\n      }\n    }\n    referenceDataset {\n      events(eventIds: $referenceEventIds) {\n        dimensions {\n          dimension {\n            name\n            type\n          }\n          value\n        }\n        eventMetadata {\n          predictionLabel\n          actualLabel\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "34de659f525e55bd322b47171511a9a7";

export default node;
