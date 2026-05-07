/**
 * @generated SignedSource<<d0af9ebc55606899faab5805fc2d22b0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Language = "PYTHON" | "TYPESCRIPT";
export type CreateCodeEvaluatorVersionInput = {
  codeEvaluatorId: string;
  language: Language;
  sourceCode: string;
};
export type EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation$variables = {
  input: CreateCodeEvaluatorVersionInput;
};
export type EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation$data = {
  readonly createCodeEvaluatorVersion: {
    readonly evaluator: {
      readonly currentVersion: {
        readonly id: string;
      } | null;
      readonly id: string;
    };
  };
};
export type EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation = {
  response: EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation$data;
  variables: EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
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
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "CodeEvaluatorVersion",
            "kind": "LinkedField",
            "name": "currentVersion",
            "plural": false,
            "selections": [
              (v1/*: any*/)
            ],
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
    "name": "EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "4b4d21174ec22dc986f4ef8e090a622b",
    "id": null,
    "metadata": {},
    "name": "EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation",
    "operationKind": "mutation",
    "text": "mutation EditCodeDatasetEvaluatorSlideover_createCodeEvaluatorVersionMutation(\n  $input: CreateCodeEvaluatorVersionInput!\n) {\n  createCodeEvaluatorVersion(input: $input) {\n    evaluator {\n      id\n      currentVersion {\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b66f49f4936385fd3f2febc3b4490ff9";

export default node;
