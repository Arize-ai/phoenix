/**
 * @generated SignedSource<<21ad45ae750c27b8088bcb91d486c724>>
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
export type useEvaluatorTaskSaveAttachCodeMutation$variables = {
  input: CreateDatasetCodeEvaluatorInput;
};
export type useEvaluatorTaskSaveAttachCodeMutation$data = {
  readonly createDatasetCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type useEvaluatorTaskSaveAttachCodeMutation = {
  response: useEvaluatorTaskSaveAttachCodeMutation$data;
  variables: useEvaluatorTaskSaveAttachCodeMutation$variables;
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
    "name": "useEvaluatorTaskSaveAttachCodeMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useEvaluatorTaskSaveAttachCodeMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "440e24c41b34762051f4415c8a16c2cd",
    "id": null,
    "metadata": {},
    "name": "useEvaluatorTaskSaveAttachCodeMutation",
    "operationKind": "mutation",
    "text": "mutation useEvaluatorTaskSaveAttachCodeMutation(\n  $input: CreateDatasetCodeEvaluatorInput!\n) {\n  createDatasetCodeEvaluator(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "32a58b3d84df34707ae56f82e7a23351";

export default node;
