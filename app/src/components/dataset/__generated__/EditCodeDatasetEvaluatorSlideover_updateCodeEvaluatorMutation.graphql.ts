/**
 * @generated SignedSource<<2bc595e3997ac13b0e12e4f1993cae21>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type UpdateCodeEvaluatorInput = {
  description?: string | null;
  evaluatorId: string;
  inputMapping?: EvaluatorInputMappingInput | null;
  language?: string | null;
  metadata?: any | null;
  name?: string | null;
  outputConfigs?: ReadonlyArray<AnnotationConfigInput> | null;
  sourceCode?: string | null;
};
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
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
export type EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation$variables = {
  input: UpdateCodeEvaluatorInput;
};
export type EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation$data = {
  readonly updateCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
      readonly language: string;
      readonly name: string;
      readonly sourceCode: string;
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
            "name": "sourceCode",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "language",
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
    "cacheID": "abf2e59b678182ffebce23757767c7a1",
    "id": null,
    "metadata": {},
    "name": "EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation EditCodeDatasetEvaluatorSlideover_updateCodeEvaluatorMutation(\n  $input: UpdateCodeEvaluatorInput!\n) {\n  updateCodeEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      sourceCode\n      language\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7ad9bdb0c0d5502928c2d28eeeffaddb";

export default node;
