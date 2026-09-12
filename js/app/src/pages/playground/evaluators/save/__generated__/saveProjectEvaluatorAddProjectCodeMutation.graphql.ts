/**
 * @generated SignedSource<<6330f374b41e433ba400fda6644c6914>>
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
export type saveProjectEvaluatorAddProjectCodeMutation$variables = {
  input: AddProjectCodeEvaluatorInput;
};
export type saveProjectEvaluatorAddProjectCodeMutation$data = {
  readonly addProjectCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type saveProjectEvaluatorAddProjectCodeMutation = {
  response: saveProjectEvaluatorAddProjectCodeMutation$data;
  variables: saveProjectEvaluatorAddProjectCodeMutation$variables;
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
    "name": "saveProjectEvaluatorAddProjectCodeMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "saveProjectEvaluatorAddProjectCodeMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "5b6718c2f694155f6651994318f320c3",
    "id": null,
    "metadata": {},
    "name": "saveProjectEvaluatorAddProjectCodeMutation",
    "operationKind": "mutation",
    "text": "mutation saveProjectEvaluatorAddProjectCodeMutation(\n  $input: AddProjectCodeEvaluatorInput!\n) {\n  addProjectCodeEvaluator(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b357e83b1a3a8a71a531dc2dbe40e159";

export default node;
