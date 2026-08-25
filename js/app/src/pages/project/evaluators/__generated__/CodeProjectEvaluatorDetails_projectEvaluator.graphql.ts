/**
 * @generated SignedSource<<20cb17f4f93adc267482d5d3c7a84ae6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type Language = "PYTHON" | "TYPESCRIPT";
import { FragmentRefs } from "relay-runtime";
export type CodeProjectEvaluatorDetails_projectEvaluator$data = {
  readonly evaluator: {
    readonly currentVersion?: {
      readonly sourceCode: string;
    } | null;
    readonly kind: EvaluatorKind;
    readonly language?: Language;
  };
  readonly " $fragmentType": "CodeProjectEvaluatorDetails_projectEvaluator";
};
export type CodeProjectEvaluatorDetails_projectEvaluator$key = {
  readonly " $data"?: CodeProjectEvaluatorDetails_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"CodeProjectEvaluatorDetails_projectEvaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "CodeProjectEvaluatorDetails_projectEvaluator",
  "selections": [
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
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "language",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "CodeEvaluatorVersion",
              "kind": "LinkedField",
              "name": "currentVersion",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "sourceCode",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "type": "CodeEvaluator",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};

(node as any).hash = "6da76f03e660753a11ce8348f68a6128";

export default node;
