/**
 * @generated SignedSource<<c7f3d403a0d2a8ed97cf4e275e03b8f8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type NewDatasetLabelDialogSetLabelsMutation$variables = {
  datasetId: string;
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
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetLabelIds"
  }
],
v1 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "datasetId",
        "variableName": "datasetId"
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
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetLabel",
  "kind": "LinkedField",
  "name": "labels",
  "plural": true,
  "selections": [
    (v3/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "NewDatasetLabelDialogSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                "args": (v2/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v3/*: any*/),
                      (v4/*: any*/)
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewDatasetLabelDialogSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                "args": (v2/*: any*/),
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
                  (v3/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v4/*: any*/)
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
    "cacheID": "6707c25818a6b235991f92c32b1a479d",
    "id": null,
    "metadata": {},
    "name": "NewDatasetLabelDialogSetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation NewDatasetLabelDialogSetLabelsMutation(\n  $datasetId: ID!\n  $datasetLabelIds: [ID!]!\n) {\n  setDatasetLabels(input: {datasetId: $datasetId, datasetLabelIds: $datasetLabelIds}) {\n    query {\n      node(id: $datasetId) {\n        __typename\n        ... on Dataset {\n          id\n          labels {\n            id\n            name\n            color\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5a3295e12874ebce5aeb57381ebceca1";

export default node;
