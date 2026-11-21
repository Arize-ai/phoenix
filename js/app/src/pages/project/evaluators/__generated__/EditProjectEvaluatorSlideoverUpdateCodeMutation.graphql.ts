/**
 * @generated SignedSource<<a97618a2f0b2c36d74a2782bfb35d87a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type UpdateProjectCodeEvaluatorInput = {
  description?: string | null;
  enabled?: boolean | null;
  evaluationDelaySeconds?: number | null;
  evaluationTarget: EvaluationTarget;
  evaluatorInputMapping?: EvaluatorInputMappingInput | null;
  filterCondition: string;
  inputMapping?: EvaluatorInputMappingInput | null;
  inputSchema?: any | null;
  name: string;
  outputConfigs?: ReadonlyArray<AnnotationConfigInput> | null;
  projectEvaluatorId: string;
  samplingRate: number;
  sandboxConfigId?: string | null;
  sourceCode?: string | null;
  tracingEnabled?: boolean | null;
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
export type EditProjectEvaluatorSlideoverUpdateCodeMutation$variables = {
  input: UpdateProjectCodeEvaluatorInput;
};
export type EditProjectEvaluatorSlideoverUpdateCodeMutation$data = {
  readonly updateProjectCodeEvaluator: {
    readonly evaluator: {
      readonly enabled: boolean;
      readonly evaluationTarget: EvaluationTarget;
      readonly filterCondition: string;
      readonly id: string;
      readonly name: string;
      readonly samplingRate: number;
      readonly tracingEnabled: boolean;
    };
  };
};
export type EditProjectEvaluatorSlideoverUpdateCodeMutation = {
  response: EditProjectEvaluatorSlideoverUpdateCodeMutation$data;
  variables: EditProjectEvaluatorSlideoverUpdateCodeMutation$variables;
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
    "name": "updateProjectCodeEvaluator",
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
          },
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
            "name": "evaluationTarget",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "filterCondition",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "samplingRate",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "enabled",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "tracingEnabled",
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
    "name": "EditProjectEvaluatorSlideoverUpdateCodeMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditProjectEvaluatorSlideoverUpdateCodeMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "f7ba83f9aef482a704ce549718a1eb13",
    "id": null,
    "metadata": {},
    "name": "EditProjectEvaluatorSlideoverUpdateCodeMutation",
    "operationKind": "mutation",
    "text": "mutation EditProjectEvaluatorSlideoverUpdateCodeMutation(\n  $input: UpdateProjectCodeEvaluatorInput!\n) {\n  updateProjectCodeEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      evaluationTarget\n      filterCondition\n      samplingRate\n      enabled\n      tracingEnabled\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7e8fef04fa7c3a50b4cb58d2b3756e9f";

export default node;
