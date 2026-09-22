/**
 * @generated SignedSource<<16f4d6d89cd72018f1e73f7765b2fb83>>
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
export type useEvaluatorTaskSaveCodeVersionMutation$variables = {
  input: CreateCodeEvaluatorVersionInput;
};
export type useEvaluatorTaskSaveCodeVersionMutation$data = {
  readonly createCodeEvaluatorVersion: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type useEvaluatorTaskSaveCodeVersionMutation = {
  response: useEvaluatorTaskSaveCodeVersionMutation$data;
  variables: useEvaluatorTaskSaveCodeVersionMutation$variables;
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
    "name": "useEvaluatorTaskSaveCodeVersionMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useEvaluatorTaskSaveCodeVersionMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "fac08794c6d88950c322265dbe5f8fc2",
    "id": null,
    "metadata": {},
    "name": "useEvaluatorTaskSaveCodeVersionMutation",
    "operationKind": "mutation",
    "text": "mutation useEvaluatorTaskSaveCodeVersionMutation(\n  $input: CreateCodeEvaluatorVersionInput!\n) {\n  createCodeEvaluatorVersion(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5d5510c09b9a46fceceac04bbc490636";

export default node;
