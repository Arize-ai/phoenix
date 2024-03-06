/**
 * @generated SignedSource<<2f6369590a2e70f9b5d347c0fcafdb3c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DocumentEvaluationSummaryValueFragment$data = {
  readonly documentEvaluationSummary: {
    readonly averageNdcg: number | null;
    readonly averagePrecision: number | null;
    readonly hitRate: number | null;
    readonly meanReciprocalRank: number | null;
  } | null;
  readonly " $fragmentType": "DocumentEvaluationSummaryValueFragment";
};
export type DocumentEvaluationSummaryValueFragment$key = {
  readonly " $data"?: DocumentEvaluationSummaryValueFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"DocumentEvaluationSummaryValueFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "evaluationName"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": require('./DocumentEvaluationSummaryValueQuery.graphql')
    }
  },
  "name": "DocumentEvaluationSummaryValueFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "evaluationName",
          "variableName": "evaluationName"
        }
      ],
      "concreteType": "DocumentEvaluationSummary",
      "kind": "LinkedField",
      "name": "documentEvaluationSummary",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "averageNdcg",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "averagePrecision",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "meanReciprocalRank",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "hitRate",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "2713c6e621dbac0dec917c29a08fff7b";

export default node;
