/**
 * @generated SignedSource<<ccac21c49553e558b1596d3f195b2ed5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
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

import DocumentEvaluationSummaryValueQuery_graphql from './DocumentEvaluationSummaryValueQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "evaluationName"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": DocumentEvaluationSummaryValueQuery_graphql,
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
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
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

(node as any).hash = "15d0652aa260c80f62acec943f615d93";

export default node;
