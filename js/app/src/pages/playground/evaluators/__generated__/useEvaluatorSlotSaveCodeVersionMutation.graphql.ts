/**
 * @generated SignedSource<<8f6e9af732522a857231c064fdf14f38>>
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
export type useEvaluatorSlotSaveCodeVersionMutation$variables = {
  input: CreateCodeEvaluatorVersionInput;
};
export type useEvaluatorSlotSaveCodeVersionMutation$data = {
  readonly createCodeEvaluatorVersion: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type useEvaluatorSlotSaveCodeVersionMutation = {
  response: useEvaluatorSlotSaveCodeVersionMutation$data;
  variables: useEvaluatorSlotSaveCodeVersionMutation$variables;
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
    "name": "useEvaluatorSlotSaveCodeVersionMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useEvaluatorSlotSaveCodeVersionMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "b26e73e991f6f13d4577eb135a80881c",
    "id": null,
    "metadata": {},
    "name": "useEvaluatorSlotSaveCodeVersionMutation",
    "operationKind": "mutation",
    "text": "mutation useEvaluatorSlotSaveCodeVersionMutation(\n  $input: CreateCodeEvaluatorVersionInput!\n) {\n  createCodeEvaluatorVersion(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "72917662f555972eeeb697112caf5780";

export default node;
