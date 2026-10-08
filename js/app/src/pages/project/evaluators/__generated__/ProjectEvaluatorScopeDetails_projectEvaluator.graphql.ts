/**
 * @generated SignedSource<<c0a85e0f764d0d393b6ab7a767220295>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorScopeDetails_projectEvaluator$data = {
  readonly evaluationDelaySeconds: number;
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationDelaySeconds",
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};

(node as any).hash = "2f4209a403f61c15f3d74f92694e0348";

export default node;
