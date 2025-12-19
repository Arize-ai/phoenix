/**
 * @generated SignedSource<<088c2d1c23ea278e099b1a6befe1aecf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type LLMDatasetEvaluatorDetails_evaluator$data = {
  readonly kind: EvaluatorKind;
  readonly prompt: {
    readonly id: string;
    readonly name: string;
  };
  readonly " $fragmentType": "LLMDatasetEvaluatorDetails_evaluator";
};
export type LLMDatasetEvaluatorDetails_evaluator$key = {
  readonly " $data"?: LLMDatasetEvaluatorDetails_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"LLMDatasetEvaluatorDetails_evaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "LLMDatasetEvaluatorDetails_evaluator",
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
      "concreteType": "Prompt",
      "kind": "LinkedField",
      "name": "prompt",
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "LLMEvaluator",
  "abstractKey": null
};

(node as any).hash = "5ad82c5b212684e115e627d08c233f0e";

export default node;
