/**
 * @generated SignedSource<<de177d6457be637c1da373649e0e922f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
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
  language: Language;
  name: string;
  outputConfigs?: ReadonlyArray<AnnotationConfigInput> | null;
  projectId: string;
  samplingRate: number;
  sandboxConfigId: string;
  sourceCode: string;
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
export type saveProjectEvaluatorCreateProjectCodeMutation$variables = {
  input: CreateProjectCodeEvaluatorInput;
};
export type saveProjectEvaluatorCreateProjectCodeMutation$data = {
  readonly createProjectCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type saveProjectEvaluatorCreateProjectCodeMutation = {
  response: saveProjectEvaluatorCreateProjectCodeMutation$data;
  variables: saveProjectEvaluatorCreateProjectCodeMutation$variables;
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
    "name": "saveProjectEvaluatorCreateProjectCodeMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "saveProjectEvaluatorCreateProjectCodeMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "8bafc978da552bd1c1ebe7077087a25a",
    "id": null,
    "metadata": {},
    "name": "saveProjectEvaluatorCreateProjectCodeMutation",
    "operationKind": "mutation",
    "text": "mutation saveProjectEvaluatorCreateProjectCodeMutation(\n  $input: CreateProjectCodeEvaluatorInput!\n) {\n  createProjectCodeEvaluator(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6bbcc5ea432b4df722f24d327714e6a0";

export default node;
