/**
 * @generated SignedSource<<043950c56ea5638649b833351c86a3bd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type SpanAsideAnnotationList_span$data = {
  readonly filteredSpanAnnotations: ReadonlyArray<{
    readonly annotatorKind: AnnotatorKind;
    readonly createdAt: string;
    readonly explanation: string | null;
    readonly id: string;
    readonly label: string | null;
    readonly name: string;
    readonly score: number | null;
  }>;
  readonly project: {
    readonly annotationConfigs: {
      readonly configs: ReadonlyArray<{
        readonly config: {
          readonly id?: string;
          readonly name?: string;
        };
      }>;
    };
    readonly id: string;
  };
  readonly " $fragmentType": "SpanAsideAnnotationList_span";
};
export type SpanAsideAnnotationList_span$key = {
  readonly " $data"?: SpanAsideAnnotationList_span$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanAsideAnnotationList_span">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
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
  "name": "SpanAsideAnnotationList_span",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Project",
      "kind": "LinkedField",
      "name": "project",
      "plural": false,
      "selections": [
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "AnnotationConfigConnection",
          "kind": "LinkedField",
          "name": "annotationConfigs",
          "plural": false,
          "selections": [
            {
              "alias": "configs",
              "args": null,
              "concreteType": "AnnotationConfigEdge",
              "kind": "LinkedField",
              "name": "edges",
              "plural": true,
              "selections": [
                {
                  "alias": "config",
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "node",
                  "plural": false,
                  "selections": [
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v0/*: any*/)
                      ],
                      "type": "Node",
                      "abstractKey": "__isNode"
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*: any*/)
                      ],
                      "type": "AnnotationConfigBase",
                      "abstractKey": "__isAnnotationConfigBase"
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
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
        (v1/*: any*/),
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "createdAt",
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

(node as any).hash = "acd29fc79e087e4e050fc61cf8592fa6";

export default node;
