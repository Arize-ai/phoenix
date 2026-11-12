/**
 * @generated SignedSource<<df0a596517000e9ceb4a501fee738935>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorMeanScoreCell_scores$data = {
  readonly annotationScoreMetrics?: ReadonlyArray<{
    readonly annotationName: string;
    readonly previousSummary: {
      readonly labelFractions: ReadonlyArray<{
        readonly fraction: number;
        readonly label: string;
      }>;
      readonly meanScore: number | null;
    } | null;
    readonly series: ReadonlyArray<{
      readonly count: number;
      readonly labelFractions: ReadonlyArray<{
        readonly fraction: number;
        readonly label: string;
      }>;
      readonly meanScore: number | null;
      readonly resultCount: number;
      readonly timestamp: string;
    }>;
    readonly summary: {
      readonly count: number;
      readonly labelCount: number;
      readonly labelFractions: ReadonlyArray<{
        readonly fraction: number;
        readonly label: string;
      }>;
      readonly meanScore: number | null;
      readonly scoreCount: number;
    } | null;
  }>;
  readonly " $fragmentType": "ProjectEvaluatorMeanScoreCell_scores";
};
export type ProjectEvaluatorMeanScoreCell_scores$key = {
  readonly " $data"?: ProjectEvaluatorMeanScoreCell_scores$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorMeanScoreCell_scores">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "concreteType": "LabelFraction",
  "kind": "LinkedField",
  "name": "labelFractions",
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
      "name": "fraction",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "includeMeanScore"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "scorePreviousTimeRange"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "scoreTimeBinConfig"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "scoreTimeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectEvaluatorMeanScoreCell_scores",
  "selections": [
    {
      "condition": "includeMeanScore",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": [
            {
              "kind": "Variable",
              "name": "previousTimeRange",
              "variableName": "scorePreviousTimeRange"
            },
            {
              "kind": "Variable",
              "name": "timeBinConfig",
              "variableName": "scoreTimeBinConfig"
            },
            {
              "kind": "Variable",
              "name": "timeRange",
              "variableName": "scoreTimeRange"
            }
          ],
          "concreteType": "EvaluatorAnnotationScoreMetrics",
          "kind": "LinkedField",
          "name": "annotationScoreMetrics",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "annotationName",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "AnnotationSummary",
              "kind": "LinkedField",
              "name": "summary",
              "plural": false,
              "selections": [
                (v0/*:: as any*/),
                (v1/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "scoreCount",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "labelCount",
                  "storageKey": null
                },
                (v2/*:: as any*/)
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "AnnotationSummary",
              "kind": "LinkedField",
              "name": "previousSummary",
              "plural": false,
              "selections": [
                (v0/*:: as any*/),
                (v2/*:: as any*/)
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "EvaluatorScoreSeriesBin",
              "kind": "LinkedField",
              "name": "series",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "timestamp",
                  "storageKey": null
                },
                (v0/*:: as any*/),
                (v1/*:: as any*/),
                (v2/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "resultCount",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ]
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "6baa0cb496e08ddef6c016bc2609e253";

export default node;
