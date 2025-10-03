/**
 * @generated SignedSource<<8a8b0d3f02afa43c8bed56048e9bc533>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetLabelConfigButtonUnsetLabelsMutation$variables = {
  datasetIds: ReadonlyArray<string>;
  datasetLabelIds: ReadonlyArray<string>;
};
export type DatasetLabelConfigButtonUnsetLabelsMutation$data = {
  readonly unsetDatasetLabels: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type DatasetLabelConfigButtonUnsetLabelsMutation = {
  response: DatasetLabelConfigButtonUnsetLabelsMutation$data;
  variables: DatasetLabelConfigButtonUnsetLabelsMutation$variables;
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
    "concreteType": "UnsetDatasetLabelsMutationPayload",
    "kind": "LinkedField",
    "name": "unsetDatasetLabels",
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
    "name": "DatasetLabelConfigButtonUnsetLabelsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DatasetLabelConfigButtonUnsetLabelsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "5e40c16e61db60212e085e76cbe680e1",
    "id": null,
    "metadata": {},
    "name": "DatasetLabelConfigButtonUnsetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation DatasetLabelConfigButtonUnsetLabelsMutation(\n  $datasetIds: [ID!]!\n  $datasetLabelIds: [ID!]!\n) {\n  unsetDatasetLabels(input: {datasetIds: $datasetIds, datasetLabelIds: $datasetLabelIds}) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "32083f371b15211d4d5810c9257d9457";

export default node;
