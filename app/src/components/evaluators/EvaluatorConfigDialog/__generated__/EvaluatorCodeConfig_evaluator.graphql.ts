/**
 * @generated SignedSource<<219229686b333892d37c52b939acc5d5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type EvaluatorCodeConfig_evaluator$data = {
  readonly id: string;
  readonly inputSchema?: any | null;
  readonly isBuiltin?: boolean;
  readonly kind?: EvaluatorKind;
  readonly name?: string;
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorCodeConfig_CodeEvaluatorForm">;
  readonly " $fragmentType": "EvaluatorCodeConfig_evaluator";
};
export type EvaluatorCodeConfig_evaluator$key = {
  readonly " $data"?: EvaluatorCodeConfig_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorCodeConfig_evaluator">;
};

const node: ReaderFragment = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "inputSchema",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "EvaluatorCodeConfig_evaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
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
          "name": "kind",
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
      "kind": "InlineFragment",
      "selections": (v0/*: any*/),
      "type": "CodeEvaluator",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": (v0/*: any*/),
      "type": "BuiltInEvaluator",
      "abstractKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "EvaluatorCodeConfig_CodeEvaluatorForm"
    }
  ],
  "type": "Node",
  "abstractKey": "__isNode"
};
})();

(node as any).hash = "d61186468fb6f530c982158f9ec16fd7";

export default node;
