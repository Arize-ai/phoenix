/**
 * @generated SignedSource<<02e3610a3f1c6a7182fcdf782a956b0b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorInputMappingControlsQuery$variables = {
  exampleId: string;
};
export type EvaluatorInputMappingControlsQuery$data = {
  readonly example: {
    readonly revision?: {
      readonly input: any;
      readonly metadata: any;
      readonly output: any;
    };
  };
};
export type EvaluatorInputMappingControlsQuery = {
  response: EvaluatorInputMappingControlsQuery$data;
  variables: EvaluatorInputMappingControlsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "exampleId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "exampleId"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetExampleRevision",
      "kind": "LinkedField",
      "name": "revision",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "input",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "output",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "metadata",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DatasetExample",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorInputMappingControlsQuery",
    "selections": [
      {
        "alias": "example",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/)
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
    "name": "EvaluatorInputMappingControlsQuery",
    "selections": [
      {
        "alias": "example",
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
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "1212441ba844bf10bd3723d5ef873d47",
    "id": null,
    "metadata": {},
    "name": "EvaluatorInputMappingControlsQuery",
    "operationKind": "query",
    "text": "query EvaluatorInputMappingControlsQuery(\n  $exampleId: ID!\n) {\n  example: node(id: $exampleId) {\n    __typename\n    ... on DatasetExample {\n      revision {\n        input\n        output\n        metadata\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e70df51d0c23c4bf2513341591074875";

export default node;
