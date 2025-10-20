/**
 * @generated SignedSource<<7327b22417301215c7f927a1a4d53141>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetLabelConfigButtonSetLabelsMutation$variables = {
  currentDatasetId: string;
  datasetIds: ReadonlyArray<string>;
  datasetLabelIds: ReadonlyArray<string>;
};
export type DatasetLabelConfigButtonSetLabelsMutation$data = {
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
export type DatasetLabelConfigButtonSetLabelsMutation = {
  response: DatasetLabelConfigButtonSetLabelsMutation$data;
  variables: DatasetLabelConfigButtonSetLabelsMutation$variables;
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
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
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
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
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
    "cacheID": "72e0b23faa08008b3300adc2a7015a5a",
    "id": null,
    "metadata": {},
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation DatasetLabelConfigButtonSetLabelsMutation(\n  $datasetIds: [ID!]!\n  $datasetLabelIds: [ID!]!\n  $currentDatasetId: ID!\n) {\n  setDatasetLabels(input: {datasetIds: $datasetIds, datasetLabelIds: $datasetLabelIds}) {\n    query {\n      node(id: $currentDatasetId) {\n        __typename\n        ... on Dataset {\n          id\n          labels {\n            id\n            name\n            color\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "376fd6919665035d938f03b2d8f69084";

export default node;
