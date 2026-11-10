/**
 * @generated SignedSource<<e4d2ba61838c6c0708f07dfacb21d062>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type EvaluatorKind = "BUILTIN" | "CODE" | "DECISION" | "LLM";
export type Language = "PYTHON" | "TYPESCRIPT";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type CreateProjectCodeEvaluatorInput = {
  description?: string | null;
  enabled?: boolean;
  evaluationDelaySeconds?: number | null;
  evaluationTarget: EvaluationTarget;
  evaluatorInputMapping: EvaluatorInputMappingInput;
  filterCondition?: string;
  inputMapping?: EvaluatorInputMappingInput | null;
  inputSchema?: any | null;
  language: Language;
  name: string;
  outputConfigs?: ReadonlyArray<AnnotationConfigInput> | null;
  projectId: string;
  samplingRate: number;
  sandboxConfigId: string;
  sourceCode: string;
  tracingEnabled?: boolean;
};
export type EvaluatorInputMappingInput = {
  literalMapping: any;
  pathMapping: any;
};
export type AnnotationConfigInput = {
  categorical: CategoricalAnnotationConfigInput;
  continuous?: never;
  freeform?: never;
} | {
  categorical?: never;
  continuous: ContinuousAnnotationConfigInput;
  freeform?: never;
} | {
  categorical?: never;
  continuous?: never;
  freeform: FreeformAnnotationConfigInput;
};
export type CategoricalAnnotationConfigInput = {
  description?: string | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  values: ReadonlyArray<CategoricalAnnotationConfigValueInput>;
};
export type CategoricalAnnotationConfigValueInput = {
  label: string;
  score?: number | null;
};
export type ContinuousAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  upperBound?: number | null;
};
export type FreeformAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection?: OptimizationDirection | null;
  threshold?: number | null;
  upperBound?: number | null;
};
export type CreateProjectCodeEvaluatorDialogContentMutation$variables = {
  input: CreateProjectCodeEvaluatorInput;
};
export type CreateProjectCodeEvaluatorDialogContentMutation$data = {
  readonly createProjectCodeEvaluator: {
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
      readonly tracingEnabled: boolean;
    };
  };
};
export type CreateProjectCodeEvaluatorDialogContentMutation = {
  response: CreateProjectCodeEvaluatorDialogContentMutation$data;
  variables: CreateProjectCodeEvaluatorDialogContentMutation$variables;
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
  "name": "tracingEnabled",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateProjectCodeEvaluatorDialogContentMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "ProjectEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "createProjectCodeEvaluator",
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
              (v8/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v9/*:: as any*/)
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
    "name": "CreateProjectCodeEvaluatorDialogContentMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "ProjectEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "createProjectCodeEvaluator",
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
              (v8/*:: as any*/),
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
                  (v9/*:: as any*/),
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
    "cacheID": "20a6226f3362389b5597fecf8f1751a5",
    "id": null,
    "metadata": {},
    "name": "CreateProjectCodeEvaluatorDialogContentMutation",
    "operationKind": "mutation",
    "text": "mutation CreateProjectCodeEvaluatorDialogContentMutation(\n  $input: CreateProjectCodeEvaluatorInput!\n) {\n  createProjectCodeEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      evaluationTarget\n      filterCondition\n      samplingRate\n      enabled\n      tracingEnabled\n      evaluator {\n        __typename\n        kind\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1586659f82f281ee9dc9651ef9d87c01";

export default node;
