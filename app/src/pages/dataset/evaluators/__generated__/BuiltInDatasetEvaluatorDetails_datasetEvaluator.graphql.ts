/**
 * @generated SignedSource<<33c5d086901ec4de1ffbbb634bfdc3dc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type BuiltInDatasetEvaluatorDetails_datasetEvaluator$data = {
  readonly evaluator: {
    readonly isBuiltin: boolean;
    readonly kind: EvaluatorKind;
    readonly name: string;
  };
  readonly id: string;
  readonly inputMapping: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
  readonly " $fragmentType": "BuiltInDatasetEvaluatorDetails_datasetEvaluator";
};
export type BuiltInDatasetEvaluatorDetails_datasetEvaluator$key = {
  readonly " $data"?: BuiltInDatasetEvaluatorDetails_datasetEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"BuiltInDatasetEvaluatorDetails_datasetEvaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "BuiltInDatasetEvaluatorDetails_datasetEvaluator",
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
      "concreteType": "EvaluatorInputMapping",
      "kind": "LinkedField",
      "name": "inputMapping",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "literalMapping",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "pathMapping",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "evaluator",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "kind",
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
          "name": "isBuiltin",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DatasetEvaluator",
  "abstractKey": null
};

(node as any).hash = "02e897eff0649ad0f594d58a59ca8def";

export default node;
