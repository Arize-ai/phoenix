/**
 * @generated SignedSource<<45efd276517ef15041df0c26c87f5604>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluationSummaryValueFragment$data = {
  readonly id: string;
  readonly spanEvaluationSummary: {
    readonly labelFractions: ReadonlyArray<{
      readonly fraction: number;
      readonly label: string;
    }>;
    readonly meanScore: number | null;
  } | null;
  readonly " $fragmentType": "EvaluationSummaryValueFragment";
};
export type EvaluationSummaryValueFragment$key = {
  readonly " $data"?: EvaluationSummaryValueFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"EvaluationSummaryValueFragment">;
};

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
      "operation": require('./EvaluationSummaryValueQuery.graphql'),
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "EvaluationSummaryValueFragment",
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
      "concreteType": "EvaluationSummary",
      "kind": "LinkedField",
      "name": "spanEvaluationSummary",
      "plural": false,
      "selections": [
        {
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "meanScore",
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

(node as any).hash = "ba0ee13567d5484ec0697c50e1a77bfa";

export default node;
