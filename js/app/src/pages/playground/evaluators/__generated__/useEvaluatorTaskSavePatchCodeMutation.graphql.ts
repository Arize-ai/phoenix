/**
 * @generated SignedSource<<9893ba235c92ef0fababe7cfdc129d0a>>
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
export type useEvaluatorTaskSavePatchCodeMutation$variables = {
  input: PatchCodeEvaluatorInput;
};
export type useEvaluatorTaskSavePatchCodeMutation$data = {
  readonly patchCodeEvaluator: {
    readonly evaluator: {
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
    };
  };
};
export type useEvaluatorTaskSavePatchCodeMutation = {
  response: useEvaluatorTaskSavePatchCodeMutation$data;
  variables: useEvaluatorTaskSavePatchCodeMutation$variables;
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
            "name": "description",
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
    "name": "useEvaluatorTaskSavePatchCodeMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useEvaluatorTaskSavePatchCodeMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "27b3cb1aefa4a4773ead5f4f2d975197",
    "id": null,
    "metadata": {},
    "name": "useEvaluatorTaskSavePatchCodeMutation",
    "operationKind": "mutation",
    "text": "mutation useEvaluatorTaskSavePatchCodeMutation(\n  $input: PatchCodeEvaluatorInput!\n) {\n  patchCodeEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      description\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9dd2d2fce499e7503782ccd2d353824d";

export default node;
