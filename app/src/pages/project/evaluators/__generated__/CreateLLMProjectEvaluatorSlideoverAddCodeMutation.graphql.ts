/**
 * @generated SignedSource<<f1f93caf3f495b2e79911b2158e6da22>>
 * @lightSyntaxTransform
 * @nogrep
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
export type CreateLLMProjectEvaluatorSlideoverAddCodeMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  input: AddProjectCodeEvaluatorInput;
};
export type CreateLLMProjectEvaluatorSlideoverAddCodeMutation$data = {
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
export type CreateLLMProjectEvaluatorSlideoverAddCodeMutation = {
  response: CreateLLMProjectEvaluatorSlideoverAddCodeMutation$data;
  variables: CreateLLMProjectEvaluatorSlideoverAddCodeMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionIds"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationTarget",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "filterCondition",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "samplingRate",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateLLMProjectEvaluatorSlideoverAddCodeMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
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
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v9/*: any*/)
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
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "CreateLLMProjectEvaluatorSlideoverAddCodeMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
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
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
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
                  (v9/*: any*/),
                  (v3/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "appendNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "evaluator",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connectionIds"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "ProjectEvaluatorEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "44cb72bd3d495392bab674150e05cf0c",
    "id": null,
    "metadata": {},
    "name": "CreateLLMProjectEvaluatorSlideoverAddCodeMutation",
    "operationKind": "mutation",
    "text": "mutation CreateLLMProjectEvaluatorSlideoverAddCodeMutation(\n  $input: AddProjectCodeEvaluatorInput!\n) {\n  addProjectCodeEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      evaluationTarget\n      filterCondition\n      samplingRate\n      enabled\n      evaluator {\n        __typename\n        kind\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ac1c1aedef79cfff5180ce0d181a4f6f";

export default node;
