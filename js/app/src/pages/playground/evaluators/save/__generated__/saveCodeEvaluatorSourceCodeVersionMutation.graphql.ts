/**
 * @generated SignedSource<<ddd2c86c28d03c66e25f3aa68acb40f0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateCodeEvaluatorVersionInput = {
  codeEvaluatorId: string;
  sourceCode: string;
};
export type saveCodeEvaluatorSourceCodeVersionMutation$variables = {
  input: CreateCodeEvaluatorVersionInput;
};
export type saveCodeEvaluatorSourceCodeVersionMutation$data = {
  readonly createCodeEvaluatorVersion: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type saveCodeEvaluatorSourceCodeVersionMutation = {
  response: saveCodeEvaluatorSourceCodeVersionMutation$data;
  variables: saveCodeEvaluatorSourceCodeVersionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "CreateCodeEvaluatorVersionPayload",
    "kind": "LinkedField",
    "name": "createCodeEvaluatorVersion",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "CodeEvaluator",
        "kind": "LinkedField",
        "name": "evaluator",
        "plural": false,
        "selections": [
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
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "saveCodeEvaluatorSourceCodeVersionMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "saveCodeEvaluatorSourceCodeVersionMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "d5a69d9917ce674f6c213248105853f1",
    "id": null,
    "metadata": {},
    "name": "saveCodeEvaluatorSourceCodeVersionMutation",
    "operationKind": "mutation",
    "text": "mutation saveCodeEvaluatorSourceCodeVersionMutation(\n  $input: CreateCodeEvaluatorVersionInput!\n) {\n  createCodeEvaluatorVersion(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "992a3526f83361346d9dc946a2e0fe67";

export default node;
