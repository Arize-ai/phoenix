/**
 * @generated SignedSource<<fad4532dd0031e01087eb0e7db32742a>>
 * @lightSyntaxTransform
 * @nogrep
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
  sandboxConfigId?: number | null;
  sourceCode: string;
};
export type AnnotationConfigInput = {
  categorical?: CategoricalAnnotationConfigInput | null;
  continuous?: ContinuousAnnotationConfigInput | null;
  freeform?: FreeformAnnotationConfigInput | null;
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
  name: string;
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
    "name": "CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "3344e4f40c9bbd010009abd93b936435",
    "id": null,
    "metadata": {},
    "name": "CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation(\n  $input: CreateCodeEvaluatorInput!\n) {\n  createCodeEvaluator(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b54683d7ab456feba514f26e75a90ec7";

export default node;
