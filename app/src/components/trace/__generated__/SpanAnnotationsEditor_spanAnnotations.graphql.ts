/**
 * @generated SignedSource<<78f8d1b06430439cb398e7fece8f7587>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotatorKind = "HUMAN" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type SpanAnnotationsEditor_spanAnnotations$data = {
  readonly filteredSpanAnnotations: ReadonlyArray<{
    readonly annotatorKind: AnnotatorKind;
    readonly explanation: string | null;
    readonly id: string;
    readonly label: string | null;
    readonly name: string;
    readonly score: number | null;
  }>;
  readonly id: string;
  readonly " $fragmentType": "SpanAnnotationsEditor_spanAnnotations";
};
export type SpanAnnotationsEditor_spanAnnotations$key = {
  readonly " $data"?: SpanAnnotationsEditor_spanAnnotations$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanAnnotationsEditor_spanAnnotations">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filterUserIds"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "SpanAnnotationsEditor_spanAnnotations",
  "selections": [
    (v0/*: any*/),
    {
      "alias": "filteredSpanAnnotations",
      "args": [
        {
          "fields": [
            {
              "kind": "Literal",
              "name": "exclude",
              "value": {
                "names": [
                  "note"
                ]
              }
            },
            {
              "fields": [
                {
                  "kind": "Variable",
                  "name": "userIds",
                  "variableName": "filterUserIds"
                }
              ],
              "kind": "ObjectValue",
              "name": "include"
            }
          ],
          "kind": "ObjectValue",
          "name": "filter"
        }
      ],
      "concreteType": "SpanAnnotation",
      "kind": "LinkedField",
      "name": "spanAnnotations",
      "plural": true,
      "selections": [
        (v0/*: any*/),
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
          "name": "annotatorKind",
          "storageKey": null
        },
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
          "name": "label",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "explanation",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};
})();

(node as any).hash = "487c5685bec6e7ab747c2bb17cb0bb2e";

export default node;
