/**
 * @generated SignedSource<<ae171d17f2b87161db6791324e1fde0a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type CodeProjectEvaluatorConfigCards_projectEvaluator$data = {
  readonly evaluationTarget: EvaluationTarget;
  readonly evaluator: {
    readonly sandboxConfig?: {
      readonly " $fragmentSpreads": FragmentRefs<"CodeEvaluatorSandboxCard_sandboxConfig">;
    } | null;
  };
  readonly inputMapping: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
  readonly " $fragmentType": "CodeProjectEvaluatorConfigCards_projectEvaluator";
};
export type CodeProjectEvaluatorConfigCards_projectEvaluator$key = {
  readonly " $data"?: CodeProjectEvaluatorConfigCards_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"CodeProjectEvaluatorConfigCards_projectEvaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "CodeProjectEvaluatorConfigCards_projectEvaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationTarget",
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
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "SandboxConfig",
              "kind": "LinkedField",
              "name": "sandboxConfig",
              "plural": false,
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "CodeEvaluatorSandboxCard_sandboxConfig"
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

(node as any).hash = "212a4d2e1ad87f29d685919629b22fde";

export default node;
