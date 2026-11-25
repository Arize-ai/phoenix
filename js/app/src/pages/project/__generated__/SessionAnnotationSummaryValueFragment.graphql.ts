/**
 * @generated SignedSource<<9ab021f881afbd00427efde13fe397dc>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionAnnotationSummaryValueFragment$data = {
  readonly sessionAnnotationSummary: {
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
  readonly " $fragmentType": "SessionAnnotationSummaryValueFragment";
};
export type SessionAnnotationSummaryValueFragment$key = {
  readonly " $data"?: SessionAnnotationSummaryValueFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionAnnotationSummaryValueFragment">;
};

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
      "name": "sessionFilterCondition"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "SessionAnnotationSummaryValueFragment",
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
          "name": "sessionFilterCondition",
          "variableName": "sessionFilterCondition"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "AnnotationSummary",
      "kind": "LinkedField",
      "name": "sessionAnnotationSummary",
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
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "028596d51a32b6a095fbdccdf0fe6589";

export default node;
