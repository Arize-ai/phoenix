/**
 * @generated SignedSource<<3846d339b24501be0bf0d13b23edaf82>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type AddProjectCodeEvaluatorInput = {
  enabled?: boolean;
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
export type CreateProjectEvaluatorSlideoverAddCodeMutation$variables = {
  input: AddProjectCodeEvaluatorInput;
};
export type CreateProjectEvaluatorSlideoverAddCodeMutation$data = {
  readonly addProjectCodeEvaluator: {
    readonly evaluator: {
      readonly enabled: boolean;
      readonly evaluationTarget: EvaluationTarget;
      readonly evaluator: {
        readonly kind: EvaluatorKind;
      };
      readonly filterCondition: string;
      readonly id: string;
      readonly name: string;
      readonly samplingRate: number;
    };
  };
};
export type CreateProjectEvaluatorSlideoverAddCodeMutation = {
  response: CreateProjectEvaluatorSlideoverAddCodeMutation$data;
  variables: CreateProjectEvaluatorSlideoverAddCodeMutation$variables;
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationTarget",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "filterCondition",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "samplingRate",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateProjectEvaluatorSlideoverAddCodeMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v8/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "CreateProjectEvaluatorSlideoverAddCodeMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  (v8/*:: as any*/),
                  (v2/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ff70f37bd491a275fe6f76ce8f736cc8",
    "id": null,
    "metadata": {},
    "name": "CreateProjectEvaluatorSlideoverAddCodeMutation",
    "operationKind": "mutation",
    "text": "mutation CreateProjectEvaluatorSlideoverAddCodeMutation(\n  $input: AddProjectCodeEvaluatorInput!\n) {\n  addProjectCodeEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      evaluationTarget\n      filterCondition\n      samplingRate\n      enabled\n      evaluator {\n        __typename\n        kind\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ba204577b1ac95036a0e00fae18c7230";

export default node;
