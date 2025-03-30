/**
 * @generated SignedSource<<624d6246d09cc1e153a6134f528ff78f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanAnnotationsEditorEditAnnotationMutation$variables = {
  annotationId: string;
  explanation?: string | null;
  label?: string | null;
  name: string;
  score?: number | null;
  spanId: string;
};
export type SpanAnnotationsEditorEditAnnotationMutation$data = {
  readonly patchSpanAnnotations: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"SpanAnnotationsEditor_spanAnnotations">;
      };
    };
  };
};
export type SpanAnnotationsEditorEditAnnotationMutation = {
  response: SpanAnnotationsEditorEditAnnotationMutation$data;
  variables: SpanAnnotationsEditorEditAnnotationMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "annotationId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "explanation"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "label"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "score"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "spanId"
},
v6 = [
  {
    "items": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "annotationId",
            "variableName": "annotationId"
          },
          {
            "kind": "Literal",
            "name": "annotatorKind",
            "value": "HUMAN"
          },
          {
            "kind": "Variable",
            "name": "explanation",
            "variableName": "explanation"
          },
          {
            "kind": "Variable",
            "name": "label",
            "variableName": "label"
          },
          {
            "kind": "Variable",
            "name": "name",
            "variableName": "name"
          },
          {
            "kind": "Variable",
            "name": "score",
            "variableName": "score"
          }
        ],
        "kind": "ObjectValue",
        "name": "input.0"
      }
    ],
    "kind": "ListValue",
    "name": "input"
  }
],
v7 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanAnnotationsEditorEditAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v6/*: any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "patchSpanAnnotations",
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
                "args": (v7/*: any*/),
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
                        "name": "SpanAnnotationsEditor_spanAnnotations"
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
    "argumentDefinitions": [
      (v5/*: any*/),
      (v0/*: any*/),
      (v3/*: any*/),
      (v2/*: any*/),
      (v4/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "SpanAnnotationsEditorEditAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v6/*: any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "patchSpanAnnotations",
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
                "args": (v7/*: any*/),
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
                  (v8/*: any*/),
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
                          (v8/*: any*/),
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
    "cacheID": "a88e5e8c3112712826128575a7e9ab1d",
    "id": null,
    "metadata": {},
    "name": "SpanAnnotationsEditorEditAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation SpanAnnotationsEditorEditAnnotationMutation(\n  $spanId: GlobalID!\n  $annotationId: GlobalID!\n  $name: String!\n  $label: String\n  $score: Float\n  $explanation: String\n) {\n  patchSpanAnnotations(input: [{annotationId: $annotationId, name: $name, label: $label, score: $score, explanation: $explanation, annotatorKind: HUMAN}]) {\n    query {\n      node(id: $spanId) {\n        __typename\n        ... on Span {\n          ...SpanAnnotationsEditor_spanAnnotations\n        }\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n\nfragment SpanAnnotationsEditor_spanAnnotations on Span {\n  id\n  spanAnnotations {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n  }\n}\n"
  }
};
})();

(node as any).hash = "555706c51818de72c69ed7855296dcab";

export default node;
