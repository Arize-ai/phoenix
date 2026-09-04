/**
 * @generated SignedSource<<2cf3639f931a56df8302b9da5f11e712>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type SessionAnnotationSummaryGroup$data = {
  readonly sessionAnnotations: ReadonlyArray<{
    readonly annotatorKind: AnnotatorKind;
    readonly createdAt: string;
    readonly explanation: string | null;
    readonly id: string;
    readonly label: string | null;
    readonly name: string;
    readonly score: number | null;
    readonly updatedAt: string;
    readonly user: {
      readonly profilePictureUrl: string | null;
      readonly username: string;
    } | null;
  }>;
  readonly summarySessionAnnotationSummaries: ReadonlyArray<{
    readonly count: number;
    readonly labelCount: number;
    readonly labelFractions: ReadonlyArray<{
      readonly fraction: number;
      readonly label: string;
    }>;
    readonly meanScore: number | null;
    readonly name: string;
    readonly scoreCount: number;
  }>;
  readonly " $fragmentType": "SessionAnnotationSummaryGroup";
};
export type SessionAnnotationSummaryGroup$key = {
  readonly " $data"?: SessionAnnotationSummaryGroup$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionAnnotationSummaryGroup">;
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
  "name": "label",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SessionAnnotationSummaryGroup",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ProjectSessionAnnotation",
      "kind": "LinkedField",
      "name": "sessionAnnotations",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "id",
          "storageKey": null
        },
        (v0/*:: as any*/),
        (v1/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "score",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "explanation",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "annotatorKind",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "createdAt",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "updatedAt",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "User",
          "kind": "LinkedField",
          "name": "user",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "username",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "profilePictureUrl",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": "summarySessionAnnotationSummaries",
      "args": [
        {
          "kind": "Literal",
          "name": "filter",
          "value": {
            "exclude": {
              "names": [
                "note"
              ]
            }
          }
        }
      ],
      "concreteType": "AnnotationSummary",
      "kind": "LinkedField",
      "name": "sessionAnnotationSummaries",
      "plural": true,
      "selections": [
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
              "name": "fraction",
              "storageKey": null
            },
            (v1/*:: as any*/)
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "meanScore",
          "storageKey": null
        },
        (v0/*:: as any*/)
      ],
      "storageKey": "sessionAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
    }
  ],
  "type": "ProjectSession",
  "abstractKey": null
};
})();

(node as any).hash = "19fb26edfe1a8946e5bf6d29a85e482f";

export default node;
