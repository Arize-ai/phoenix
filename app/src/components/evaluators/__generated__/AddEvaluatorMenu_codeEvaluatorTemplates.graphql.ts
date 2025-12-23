/**
 * @generated SignedSource<<e0f426da28e092f0f5850ffb26343cf4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type AddEvaluatorMenu_codeEvaluatorTemplates$data = {
  readonly builtInEvaluators: ReadonlyArray<{
    readonly id: string;
    readonly kind: EvaluatorKind;
    readonly name: string;
  }>;
  readonly " $fragmentType": "AddEvaluatorMenu_codeEvaluatorTemplates";
};
export type AddEvaluatorMenu_codeEvaluatorTemplates$key = {
  readonly " $data"?: AddEvaluatorMenu_codeEvaluatorTemplates$data;
  readonly " $fragmentSpreads": FragmentRefs<"AddEvaluatorMenu_codeEvaluatorTemplates">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "AddEvaluatorMenu_codeEvaluatorTemplates",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "BuiltInEvaluator",
      "kind": "LinkedField",
      "name": "builtInEvaluators",
      "plural": true,
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "kind",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "0e7d4cfb6410618b9cbafa5a8be13d2e";

export default node;
