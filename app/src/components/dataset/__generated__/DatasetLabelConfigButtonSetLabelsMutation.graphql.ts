/**
 * @generated SignedSource<<295e9f27dd7c7603e2d4440b1aa09671>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetLabelConfigButtonSetLabelsMutation$variables = {
  datasetIds: ReadonlyArray<string>;
  datasetLabelIds: ReadonlyArray<string>;
};
export type DatasetLabelConfigButtonSetLabelsMutation$data = {
  readonly setDatasetLabels: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type DatasetLabelConfigButtonSetLabelsMutation = {
  response: DatasetLabelConfigButtonSetLabelsMutation$data;
  variables: DatasetLabelConfigButtonSetLabelsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetIds"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetLabelIds"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
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
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "7c03922b737ca27f6e8339e69a1fa033",
    "id": null,
    "metadata": {},
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation DatasetLabelConfigButtonSetLabelsMutation(\n  $datasetIds: [ID!]!\n  $datasetLabelIds: [ID!]!\n) {\n  setDatasetLabels(input: {datasetIds: $datasetIds, datasetLabelIds: $datasetLabelIds}) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5f1cd6e67ae39d51d8a10335166bf7fb";

export default node;
