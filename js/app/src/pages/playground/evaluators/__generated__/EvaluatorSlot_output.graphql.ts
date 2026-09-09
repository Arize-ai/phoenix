/**
 * @generated SignedSource<<d98e6c013e60427fc18c348ff149ffac>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type EvaluatorSlot_output$data = {
  readonly __typename: "CategoricalAnnotationConfig";
  readonly name: string;
  readonly optimizationDirection: OptimizationDirection;
  readonly values: ReadonlyArray<{
    readonly label: string;
    readonly score: number | null;
  }>;
  readonly " $fragmentType": "EvaluatorSlot_output";
} | {
  readonly __typename: "ContinuousAnnotationConfig";
  readonly lowerBound: number | null;
  readonly name: string;
  readonly optimizationDirection: OptimizationDirection;
  readonly upperBound: number | null;
  readonly " $fragmentType": "EvaluatorSlot_output";
} | {
  readonly __typename: "FreeformAnnotationConfig";
  readonly lowerBound: number | null;
  readonly name: string;
  readonly optimizationDirection: OptimizationDirection;
  readonly threshold: number | null;
  readonly upperBound: number | null;
  readonly " $fragmentType": "EvaluatorSlot_output";
} | {
  // This will never be '%other', but we need some
  // value in case none of the concrete values match.
  readonly __typename: "%other";
  readonly " $fragmentType": "EvaluatorSlot_output";
};
export type EvaluatorSlot_output$key = {
  readonly " $data"?: EvaluatorSlot_output$data;
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorSlot_output">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "EvaluatorSlot_output",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "__typename",
      "storageKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v0/*:: as any*/),
        (v1/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "CategoricalAnnotationValue",
          "kind": "LinkedField",
          "name": "values",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "label",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "score",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "type": "CategoricalAnnotationConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v0/*:: as any*/),
        (v1/*:: as any*/),
        (v2/*:: as any*/),
        (v3/*:: as any*/)
      ],
      "type": "ContinuousAnnotationConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v0/*:: as any*/),
        (v1/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "threshold",
          "storageKey": null
        },
        (v2/*:: as any*/),
        (v3/*:: as any*/)
      ],
      "type": "FreeformAnnotationConfig",
      "abstractKey": null
    }
  ],
  "type": "BuiltInEvaluatorOutputConfig",
  "abstractKey": "__isBuiltInEvaluatorOutputConfig"
};
})();

(node as any).hash = "0ff90187dad90754bdc20a5dad91307d";

export default node;
