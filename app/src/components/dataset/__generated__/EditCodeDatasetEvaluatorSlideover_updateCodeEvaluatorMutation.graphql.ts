/**
 * @generated SignedSource<<83a6be7eef1afeaf049ba2e145ff8fde>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Language = "PYTHON" | "TYPESCRIPT";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type UpdateCodeEvaluatorInput = {
  description?: string | null;
  id: string;
  inputMapping?: EvaluatorInputMappingInput | null;
  language?: Language | null;
  name?: string | null;
  outputConfigs?: ReadonlyArray<AnnotationConfigInput> | null;
  sandboxConfigId?: string | null;
  sourceCode?: string | null;
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
export type EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation$variables = {
  input: UpdateCodeEvaluatorInput;
};
export type EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation$data = {
  readonly updateCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation = {
  response: EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation$data;
  variables: EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation$variables;
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
    "name": "updateCodeEvaluator",
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
    "name": "EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "faa84b0c319a62c888f7aec62a90da99",
    "id": null,
    "metadata": {},
    "name": "EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation(\n  $input: UpdateCodeEvaluatorInput!\n) {\n  updateCodeEvaluator(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6e0ca3adbe91f05c0c850fe8130d413e";

export default node;
