/**
 * @generated SignedSource<<263d3240e8057ed789c4eb1d86d7cfd9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorScopeDetails_projectEvaluator$data = {
  readonly evaluationTarget: EvaluationTarget;
  readonly filterCondition: string;
  readonly samplingRate: number;
  readonly " $fragmentType": "ProjectEvaluatorScopeDetails_projectEvaluator";
};
export type ProjectEvaluatorScopeDetails_projectEvaluator$key = {
  readonly " $data"?: ProjectEvaluatorScopeDetails_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorScopeDetails_projectEvaluator">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorScopeDetails_projectEvaluator",
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
      "kind": "ScalarField",
      "name": "filterCondition",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "samplingRate",
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};

(node as any).hash = "206d2fc44e707d0e5030e443056ed522";

export default node;
