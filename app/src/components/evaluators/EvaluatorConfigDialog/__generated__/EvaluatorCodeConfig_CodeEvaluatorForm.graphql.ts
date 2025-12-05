/**
 * @generated SignedSource<<91942452ff90ce30875439cd423ee67d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorCodeConfig_CodeEvaluatorForm$data = {
  readonly isBuiltin?: boolean;
  readonly name?: string;
  readonly " $fragmentSpreads": FragmentRefs<"ContainsEvaluatorForm_query">;
  readonly " $fragmentType": "EvaluatorCodeConfig_CodeEvaluatorForm";
};
export type EvaluatorCodeConfig_CodeEvaluatorForm$key = {
  readonly " $data"?: EvaluatorCodeConfig_CodeEvaluatorForm$data;
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorCodeConfig_CodeEvaluatorForm">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "EvaluatorCodeConfig_CodeEvaluatorForm",
  "selections": [
    {
      "kind": "InlineFragment",
      "selections": [
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
      "type": "Evaluator",
      "abstractKey": "__isEvaluator"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ContainsEvaluatorForm_query"
    }
  ],
  "type": "Node",
  "abstractKey": "__isNode"
};

(node as any).hash = "7b510a943d1f836700b9177ef16ef5cd";

export default node;
