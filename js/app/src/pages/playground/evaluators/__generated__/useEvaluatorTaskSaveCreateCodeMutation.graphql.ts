/**
 * @generated SignedSource<<581cc883201aa158b5a5cd2f2b40640b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Language = "PYTHON" | "TYPESCRIPT";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type CreateCodeEvaluatorInput = {
  description?: string | null;
  inputMapping?: EvaluatorInputMappingInput | null;
  language: Language;
  name: string;
  outputConfigs?: ReadonlyArray<AnnotationConfigInput> | null;
  sandboxConfigId: string;
  sourceCode: string;
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
export type EvaluatorInputMappingInput = {
  literalMapping: any;
  pathMapping: any;
};
export type useEvaluatorTaskSaveCreateCodeMutation$variables = {
  input: CreateCodeEvaluatorInput;
};
export type useEvaluatorTaskSaveCreateCodeMutation$data = {
  readonly createCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type useEvaluatorTaskSaveCreateCodeMutation = {
  response: useEvaluatorTaskSaveCreateCodeMutation$data;
  variables: useEvaluatorTaskSaveCreateCodeMutation$variables;
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
    "concreteType": "CodeEvaluatorMutationPayload",
    "kind": "LinkedField",
    "name": "createCodeEvaluator",
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
    "name": "useEvaluatorTaskSaveCreateCodeMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useEvaluatorTaskSaveCreateCodeMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "076ebb185b5080eeb0c94baf09f7a805",
    "id": null,
    "metadata": {},
    "name": "useEvaluatorTaskSaveCreateCodeMutation",
    "operationKind": "mutation",
    "text": "mutation useEvaluatorTaskSaveCreateCodeMutation(\n  $input: CreateCodeEvaluatorInput!\n) {\n  createCodeEvaluator(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ae0b240d3722b4e121dc7b11df4c826b";

export default node;
