/**
 * @generated SignedSource<<abc6b9b78d67ec45fcbe63dee41eedaf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type NewDatasetLabelDialogSetLabelsMutation$variables = {
  currentDatasetId: string;
  datasetIds: ReadonlyArray<string>;
  datasetLabelIds: ReadonlyArray<string>;
};
export type NewDatasetLabelDialogSetLabelsMutation$data = {
  readonly setDatasetLabels: {
    readonly query: {
      readonly node: {
        readonly id?: string;
        readonly labels?: ReadonlyArray<{
          readonly color: string;
          readonly id: string;
          readonly name: string;
        }>;
      };
    };
  };
};
export type NewDatasetLabelDialogSetLabelsMutation = {
  response: NewDatasetLabelDialogSetLabelsMutation$data;
  variables: NewDatasetLabelDialogSetLabelsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "currentDatasetId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetIds"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetLabelIds"
},
v3 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "datasetIds",
        "variableName": "datasetIds"
      },
      {
        "kind": "Variable",
        "name": "datasetLabelIds",
        "variableName": "datasetLabelIds"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "currentDatasetId"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetLabel",
  "kind": "LinkedField",
  "name": "labels",
  "plural": true,
  "selections": [
    (v5/*: any*/),
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
      "name": "color",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "NewDatasetLabelDialogSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "SetDatasetLabelsMutationPayload",
        "kind": "LinkedField",
        "name": "setDatasetLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v4/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v5/*: any*/),
                      (v6/*: any*/)
                    ],
                    "type": "Dataset",
                    "abstractKey": null
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
    "type": "Mutation",
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
    "name": "NewDatasetLabelDialogSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "SetDatasetLabelsMutationPayload",
        "kind": "LinkedField",
        "name": "setDatasetLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v4/*: any*/),
                "concreteType": null,
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
                  },
                  (v5/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v6/*: any*/)
                    ],
                    "type": "Dataset",
                    "abstractKey": null
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
    ]
  },
  "params": {
    "cacheID": "6d08d5d9e333102aac1b4224a3f6c208",
    "id": null,
    "metadata": {},
    "name": "NewDatasetLabelDialogSetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation NewDatasetLabelDialogSetLabelsMutation(\n  $datasetIds: [ID!]!\n  $datasetLabelIds: [ID!]!\n  $currentDatasetId: ID!\n) {\n  setDatasetLabels(input: {datasetIds: $datasetIds, datasetLabelIds: $datasetLabelIds}) {\n    query {\n      node(id: $currentDatasetId) {\n        __typename\n        ... on Dataset {\n          id\n          labels {\n            id\n            name\n            color\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6c55ba5246323a6c7692773e67c7c889";

export default node;
