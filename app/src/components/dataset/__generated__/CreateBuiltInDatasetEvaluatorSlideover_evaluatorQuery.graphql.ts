/**
 * @generated SignedSource<<3967f37d0811002a4342457a53b0e3d5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
export type CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery$variables = {
  evaluatorId: string;
};
export type CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery$data = {
  readonly evaluator: {
    readonly description?: string | null;
    readonly id: string;
    readonly inputSchema?: any | null;
    readonly isBuiltin?: boolean;
    readonly kind?: EvaluatorKind;
    readonly name?: string;
  };
};
export type CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery = {
  response: CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery$data;
  variables: CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "evaluatorId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorId"
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
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "kind",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "isBuiltin",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "description",
      "storageKey": null
    }
  ],
  "type": "Evaluator",
  "abstractKey": "__isEvaluator"
},
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "inputSchema",
      "storageKey": null
    }
  ],
  "type": "BuiltInEvaluator",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "evaluator",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/)
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
    "name": "CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "evaluator",
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
          (v3/*: any*/),
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b0be6b7ea7fbd22ae6bf9515923620f8",
    "id": null,
    "metadata": {},
    "name": "CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery",
    "operationKind": "query",
    "text": "query CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery(\n  $evaluatorId: ID!\n) {\n  evaluator: node(id: $evaluatorId) {\n    __typename\n    id\n    ... on Evaluator {\n      __isEvaluator: __typename\n      name\n      kind\n      isBuiltin\n      description\n    }\n    ... on BuiltInEvaluator {\n      inputSchema\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "086237c5721995d74a997c6d9cd12b2e";

export default node;
