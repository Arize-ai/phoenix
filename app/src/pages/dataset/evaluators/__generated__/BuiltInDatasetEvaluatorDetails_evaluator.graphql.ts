/**
 * @generated SignedSource<<ac7bba8b97a756045d846c049fdef46e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type BuiltInDatasetEvaluatorDetails_evaluator$data = {
  readonly inputSchema: any | null;
  readonly kind: EvaluatorKind;
  readonly metadata: any;
  readonly " $fragmentType": "BuiltInDatasetEvaluatorDetails_evaluator";
};
export type BuiltInDatasetEvaluatorDetails_evaluator$key = {
  readonly " $data"?: BuiltInDatasetEvaluatorDetails_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"BuiltInDatasetEvaluatorDetails_evaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "BuiltInDatasetEvaluatorDetails_evaluator",
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
      "name": "metadata",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "inputSchema",
      "storageKey": null
    }
  ],
  "type": "BuiltInEvaluator",
  "abstractKey": null
};

(node as any).hash = "5c744f2946cc3191b340d6a7c894526d";

export default node;
