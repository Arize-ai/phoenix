/**
 * @generated SignedSource<<4f28e7cd6bd133d9c7de61aee3eed0f5>>
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
export type saveCodeEvaluatorSourcePatchCodeMutation$variables = {
  input: PatchCodeEvaluatorInput;
};
export type saveCodeEvaluatorSourcePatchCodeMutation$data = {
  readonly patchCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type saveCodeEvaluatorSourcePatchCodeMutation = {
  response: saveCodeEvaluatorSourcePatchCodeMutation$data;
  variables: saveCodeEvaluatorSourcePatchCodeMutation$variables;
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
    "name": "saveCodeEvaluatorSourcePatchCodeMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "saveCodeEvaluatorSourcePatchCodeMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "33b5059987448efacf7d27cf5a5849ee",
    "id": null,
    "metadata": {},
    "name": "saveCodeEvaluatorSourcePatchCodeMutation",
    "operationKind": "mutation",
    "text": "mutation saveCodeEvaluatorSourcePatchCodeMutation(\n  $input: PatchCodeEvaluatorInput!\n) {\n  patchCodeEvaluator(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f9a8bb12dc6d2e2b3016bd283ef93e70";

export default node;
