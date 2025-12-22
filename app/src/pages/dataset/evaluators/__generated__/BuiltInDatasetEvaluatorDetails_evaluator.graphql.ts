/**
 * @generated SignedSource<<a8d74c2ff3bdc6b7031c886665e90345>>
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
  readonly isBuiltin: boolean;
  readonly kind: EvaluatorKind;
  readonly metadata: any;
  readonly name: string;
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
      "name": "name",
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "isBuiltin",
      "storageKey": null
    }
  ],
  "type": "BuiltInEvaluator",
  "abstractKey": null
};

(node as any).hash = "3850a3dff56843bfd9c9f9a9ff43aadc";

export default node;
