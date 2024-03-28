/**
 * @generated SignedSource<<19c61ceac4056cca0c2bff5682151edc>>
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
  readonly id: string;
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
      "fragmentPathInResult": [
        "node"
      ],
      "operation": require('./DocumentEvaluationSummaryValueQuery.graphql'),
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "7ff5a61c190ffed0761777c61a4fb476";

export default node;
