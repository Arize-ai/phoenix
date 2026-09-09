/**
 * @generated SignedSource<<c50181b75a5388b4b3f24dfa60ef4579>>
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
export type EvaluatorSlotEditorAttachCodeMutation$variables = {
  input: CreateDatasetCodeEvaluatorInput;
};
export type EvaluatorSlotEditorAttachCodeMutation$data = {
  readonly createDatasetCodeEvaluator: {
    readonly evaluator: {
      readonly id: string;
    };
  };
};
export type EvaluatorSlotEditorAttachCodeMutation = {
  response: EvaluatorSlotEditorAttachCodeMutation$data;
  variables: EvaluatorSlotEditorAttachCodeMutation$variables;
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
    "name": "EvaluatorSlotEditorAttachCodeMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EvaluatorSlotEditorAttachCodeMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "d7a2e7365797bc548bbf99489a04acfb",
    "id": null,
    "metadata": {},
    "name": "EvaluatorSlotEditorAttachCodeMutation",
    "operationKind": "mutation",
    "text": "mutation EvaluatorSlotEditorAttachCodeMutation(\n  $input: CreateDatasetCodeEvaluatorInput!\n) {\n  createDatasetCodeEvaluator(input: $input) {\n    evaluator {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d2b5f53c9eebe7595c737f62ed3a32c5";

export default node;
