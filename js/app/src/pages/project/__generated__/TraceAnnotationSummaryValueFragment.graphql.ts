/**
 * @generated SignedSource<<0de38bf1718cbd68820b96d488bc6ee5>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TraceAnnotationSummaryValueFragment$data = {
  readonly id: string;
  readonly traceAnnotationSummary: {
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
  readonly " $fragmentType": "TraceAnnotationSummaryValueFragment";
};
export type TraceAnnotationSummaryValueFragment$key = {
  readonly " $data"?: TraceAnnotationSummaryValueFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"TraceAnnotationSummaryValueFragment">;
};

import TraceAnnotationSummaryValueQuery_graphql from './TraceAnnotationSummaryValueQuery.graphql';

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
      "operation": TraceAnnotationSummaryValueQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "TraceAnnotationSummaryValueFragment",
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
      "name": "traceAnnotationSummary",
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

(node as any).hash = "524af87886ce036b991e89f39f701674";

export default node;
