/**
 * @generated SignedSource<<b7e5d106e660675baa57cd9a1a92e44d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type CreateDatasetCodeEvaluatorInput = {
  datasetId: string;
  description?: string | null;
  evaluatorId: string;
  inputMapping?: EvaluatorInputMappingInput | null;
  name: string;
  outputConfigs?: ReadonlyArray<AnnotationConfigInput> | null;
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
export type saveDatasetEvaluatorAttachCodeMutation$variables = {
  input: CreateDatasetCodeEvaluatorInput;
};
export type saveDatasetEvaluatorAttachCodeMutation$data = {
  readonly createDatasetCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type saveDatasetEvaluatorAttachCodeMutation = {
  response: saveDatasetEvaluatorAttachCodeMutation$data;
  variables: saveDatasetEvaluatorAttachCodeMutation$variables;
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
    "concreteType": "DatasetEvaluatorMutationPayload",
    "kind": "LinkedField",
    "name": "createDatasetCodeEvaluator",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetEvaluator",
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
    "name": "saveDatasetEvaluatorAttachCodeMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "saveDatasetEvaluatorAttachCodeMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "e01cbaa9bfdf1b60482a777cdc1538fe",
    "id": null,
    "metadata": {},
    "name": "saveDatasetEvaluatorAttachCodeMutation",
    "operationKind": "mutation",
    "text": "mutation saveDatasetEvaluatorAttachCodeMutation(\n  $input: CreateDatasetCodeEvaluatorInput!\n) {\n  createDatasetCodeEvaluator(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "cd320c8af046254109e4d36938d222e8";

export default node;
