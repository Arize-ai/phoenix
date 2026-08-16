/**
 * @generated SignedSource<<5e1a4787967d842f5c0f0fd50b675562>>
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
export type CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation$variables = {
  input: CreateCodeEvaluatorInput;
};
export type CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation$data = {
  readonly createCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
      readonly name: string;
    };
  };
};
export type CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation = {
  response: CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation$data;
  variables: CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation$variables;
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
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
    "name": "CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "b978b7f8c7265cde32cf9fc460a45b29",
    "id": null,
    "metadata": {},
    "name": "CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation(\n  $input: CreateCodeEvaluatorInput!\n) {\n  createCodeEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "cb2c233fbb5a381097025d466d3c798f";

export default node;
