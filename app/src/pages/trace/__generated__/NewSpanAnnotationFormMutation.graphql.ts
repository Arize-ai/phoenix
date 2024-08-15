/**
 * @generated SignedSource<<01d86be78c16abd5b9e41431b756515e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotatorKind = "HUMAN" | "LLM";
export type CreateSpanAnnotationInput = {
  annotatorKind: AnnotatorKind;
  explanation?: string | null;
  label?: string | null;
  metadata?: any;
  name: string;
  score?: number | null;
  spanId: string;
};
export type NewSpanAnnotationFormMutation$variables = {
  input: CreateSpanAnnotationInput;
  spanId: string;
};
export type NewSpanAnnotationFormMutation$data = {
  readonly createSpanAnnotations: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"EditSpanAnnotationsDialog_spanAnnotations">;
      };
    };
  };
};
export type NewSpanAnnotationFormMutation = {
  response: NewSpanAnnotationFormMutation$data;
  variables: NewSpanAnnotationFormMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanId"
  }
],
v1 = [
  {
    "items": [
      {
        "kind": "Variable",
        "name": "input.0",
        "variableName": "input"
      }
    ],
    "kind": "ListValue",
    "name": "input"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "NewSpanAnnotationFormMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createSpanAnnotations",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v2/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "EditSpanAnnotationsDialog_spanAnnotations"
                      }
                    ],
                    "type": "Span",
                    "abstractKey": null
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
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewSpanAnnotationFormMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createSpanAnnotations",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v2/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  {
                    "kind": "TypeDiscriminator",
                    "abstractKey": "__isNode"
                  },
                  (v3/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SpanAnnotation",
                        "kind": "LinkedField",
                        "name": "spanAnnotations",
                        "plural": true,
                        "selections": [
                          (v3/*: any*/),
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
    ]
  },
  "params": {
    "cacheID": "d6f016f4dfb0c142854c3ecd840b09f5",
    "id": null,
    "metadata": {},
    "name": "NewSpanAnnotationFormMutation",
    "operationKind": "mutation",
    "text": "mutation NewSpanAnnotationFormMutation(\n  $input: CreateSpanAnnotationInput!\n  $spanId: GlobalID!\n) {\n  createSpanAnnotations(input: [$input]) {\n    query {\n      node(id: $spanId) {\n        __typename\n        ... on Span {\n          ...EditSpanAnnotationsDialog_spanAnnotations\n        }\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n\nfragment EditSpanAnnotationsDialog_spanAnnotations on Span {\n  id\n  spanAnnotations {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n  }\n}\n"
  }
};
})();

(node as any).hash = "ded0a7a64a2706f6ec472a63c1c57eca";

export default node;
