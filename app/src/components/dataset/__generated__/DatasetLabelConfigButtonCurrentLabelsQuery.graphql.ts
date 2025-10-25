/**
 * @generated SignedSource<<78cd89741f67e350c1d7abb4535b5dfd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetLabelConfigButtonCurrentLabelsQuery$variables = {
  datasetId: string;
};
export type DatasetLabelConfigButtonCurrentLabelsQuery$data = {
  readonly dataset: {
    readonly labels?: ReadonlyArray<{
      readonly id: string;
    }>;
  };
};
export type DatasetLabelConfigButtonCurrentLabelsQuery = {
  response: DatasetLabelConfigButtonCurrentLabelsQuery$data;
  variables: DatasetLabelConfigButtonCurrentLabelsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": [
        (v2/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetLabelConfigButtonCurrentLabelsQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DatasetLabelConfigButtonCurrentLabelsQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
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
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e796c8365bbe547356c37d72512e6bd5",
    "id": null,
    "metadata": {},
    "name": "DatasetLabelConfigButtonCurrentLabelsQuery",
    "operationKind": "query",
    "text": "query DatasetLabelConfigButtonCurrentLabelsQuery(\n  $datasetId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      labels {\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "fadd4f36873a941f2a0d296de5cdb916";

export default node;
