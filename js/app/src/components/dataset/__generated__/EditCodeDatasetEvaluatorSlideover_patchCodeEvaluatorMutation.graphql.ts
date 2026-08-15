/**
 * @generated SignedSource<<9f264bfeaca20a62b1f4c05a30774685>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PatchCodeEvaluatorInput = {
  description?: string | null;
  id: string;
  inputMapping?: EvaluatorInputMappingInput | null;
  name?: string | null;
  outputConfigs?: ReadonlyArray<AnnotationConfigInput> | null;
  sandboxConfigId?: string | null;
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
export type EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation$variables = {
  input: PatchCodeEvaluatorInput;
};
export type EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation$data = {
  readonly patchCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation = {
  response: EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation$data;
  variables: EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation$variables;
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
    "name": "patchCodeEvaluator",
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
    "name": "EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "e8017618901f470fcef19d443b2fb526",
    "id": null,
    "metadata": {},
    "name": "EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation EditCodeDatasetEvaluatorSlideover_patchCodeEvaluatorMutation(\n  $input: PatchCodeEvaluatorInput!\n) {\n  patchCodeEvaluator(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "81192f715f22de037984cf405b8b8848";

export default node;
