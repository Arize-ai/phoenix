/**
 * @generated SignedSource<<67e5a2ec779e551bb0cf12c8a79f0dcf>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type AddProjectCodeEvaluatorInput = {
  enabled?: boolean;
  evaluationDelaySeconds?: number | null;
  evaluationTarget: EvaluationTarget;
  evaluatorId: string;
  filterCondition?: string;
  inputMapping?: EvaluatorInputMappingInput | null;
  name: string;
  projectId: string;
  samplingRate: number;
};
export type EvaluatorInputMappingInput = {
  literalMapping: any;
  pathMapping: any;
};
export type useEvaluatorSlotSaveAddProjectCodeMutation$variables = {
  input: AddProjectCodeEvaluatorInput;
};
export type useEvaluatorSlotSaveAddProjectCodeMutation$data = {
  readonly addProjectCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type useEvaluatorSlotSaveAddProjectCodeMutation = {
  response: useEvaluatorSlotSaveAddProjectCodeMutation$data;
  variables: useEvaluatorSlotSaveAddProjectCodeMutation$variables;
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
    "concreteType": "ProjectEvaluatorMutationPayload",
    "kind": "LinkedField",
    "name": "addProjectCodeEvaluator",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ProjectEvaluator",
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
    "name": "useEvaluatorSlotSaveAddProjectCodeMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useEvaluatorSlotSaveAddProjectCodeMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "31ea9b9c245e558eefb3b0407b044e41",
    "id": null,
    "metadata": {},
    "name": "useEvaluatorSlotSaveAddProjectCodeMutation",
    "operationKind": "mutation",
    "text": "mutation useEvaluatorSlotSaveAddProjectCodeMutation(\n  $input: AddProjectCodeEvaluatorInput!\n) {\n  addProjectCodeEvaluator(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5578a336dbb7a6013983cf16f8dcad24";

export default node;
