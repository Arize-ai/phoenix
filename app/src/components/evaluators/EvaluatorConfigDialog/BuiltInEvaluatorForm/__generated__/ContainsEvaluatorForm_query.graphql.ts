/**
 * @generated SignedSource<<43f329399551c84d8200d4985ee6e3a2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type ContainsEvaluatorForm_query$data = {
  readonly id: string;
  readonly inputSchema?: any | null;
  readonly isBuiltin?: boolean;
  readonly kind?: EvaluatorKind;
  readonly name?: string;
  readonly " $fragmentType": "ContainsEvaluatorForm_query";
};
export type ContainsEvaluatorForm_query$key = {
  readonly " $data"?: ContainsEvaluatorForm_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"ContainsEvaluatorForm_query">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ContainsEvaluatorForm_query",
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
      "selections": [
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
    }
  ],
  "type": "Node",
  "abstractKey": "__isNode"
};

(node as any).hash = "d0864ccc4525514cb00888f7e8427e15";

export default node;
