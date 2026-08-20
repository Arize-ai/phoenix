/**
 * @generated SignedSource<<98a2b34abce1b4a14c67112bfcfd4b32>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotationSummaryValueFragment$data = {
  readonly id: string;
  readonly spanAnnotationSummary: {
    readonly count: number;
    readonly labelCount: number;
    readonly labelFractions: ReadonlyArray<{
      readonly fraction: number;
      readonly label: string;
    }>;
    readonly meanScore: number | null;
    readonly name: string;
    readonly scoreCount: number;
  } | null;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectAnnotationConfigsByNameFragment">;
  readonly " $fragmentType": "AnnotationSummaryValueFragment";
};
export type AnnotationSummaryValueFragment$key = {
  readonly " $data"?: AnnotationSummaryValueFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryValueFragment">;
};

import AnnotationSummaryValueQuery_graphql from './AnnotationSummaryValueQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "annotationName"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filterCondition"
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
      "operation": AnnotationSummaryValueQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "AnnotationSummaryValueFragment",
  "selections": [
    {
      "args": [
        {
          "items": [
            {
              "kind": "Variable",
              "name": "annotationConfigNames.0",
              "variableName": "annotationName"
            }
          ],
          "kind": "ListValue",
          "name": "annotationConfigNames"
        },
        {
          "kind": "Literal",
          "name": "first",
          "value": 1
        }
      ],
      "kind": "FragmentSpread",
      "name": "ProjectAnnotationConfigsByNameFragment"
    },
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "annotationName",
          "variableName": "annotationName"
        },
        {
          "kind": "Variable",
          "name": "filterCondition",
          "variableName": "filterCondition"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "AnnotationSummary",
      "kind": "LinkedField",
      "name": "spanAnnotationSummary",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "count",
          "storageKey": null
        },
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

(node as any).hash = "0ec30602fb60295ea057f41660c31bfa";

export default node;
