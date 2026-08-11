/**
 * @generated SignedSource<<0594ef95c2efca8045f03aa1bc894c54>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorScopeDetails_projectEvaluator$data = {
  readonly enabled: boolean;
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
      "name": "enabled",
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};

(node as any).hash = "83eb231c25da9938f9c3b1406257e559";

export default node;
