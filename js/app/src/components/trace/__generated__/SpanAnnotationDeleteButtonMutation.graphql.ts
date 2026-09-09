/**
 * @generated SignedSource<<0b84739172ee2fbe19f60de91c249b8e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanAnnotationDeleteButtonMutation$variables = {
  annotationId: string;
  filterUserIds?: ReadonlyArray<string | null> | null;
  isNote: boolean;
  spanId: string;
};
export type SpanAnnotationDeleteButtonMutation$data = {
  readonly deleteSpanAnnotations?: {
    readonly " $fragmentSpreads": FragmentRefs<"SpanAnnotationDeleteButton_payload">;
  };
  readonly deleteSpanNotes?: {
    readonly " $fragmentSpreads": FragmentRefs<"SpanAnnotationDeleteButton_payload">;
  };
};
export type SpanAnnotationDeleteButtonMutation = {
  response: SpanAnnotationDeleteButtonMutation$data;
  variables: SpanAnnotationDeleteButtonMutation$variables;
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
  "name": "filterUserIds"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "isNote"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "spanId"
},
v4 = [
  {
    "fields": [
      {
        "items": [
          {
            "kind": "Variable",
            "name": "annotationIds.0",
            "variableName": "annotationId"
          }
        ],
        "kind": "ListValue",
        "name": "annotationIds"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v5 = [
  {
    "args": null,
    "kind": "FragmentSpread",
    "name": "SpanAnnotationDeleteButton_payload"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = {
  "names": [
    "note"
  ]
},
v8 = [
  {
    "kind": "Literal",
    "name": "filter",
    "value": {
      "exclude": (v7/*:: as any*/)
    }
  }
],
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v18 = [
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
        "args": [
          {
            "kind": "Variable",
            "name": "id",
            "variableName": "spanId"
          }
        ],
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
          (v6/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": "summarySpanAnnotations",
                "args": (v8/*:: as any*/),
                "concreteType": "SpanAnnotation",
                "kind": "LinkedField",
                "name": "spanAnnotations",
                "plural": true,
                "selections": [
                  (v6/*:: as any*/),
                  (v9/*:: as any*/),
                  (v10/*:: as any*/),
                  (v11/*:: as any*/),
                  (v12/*:: as any*/),
                  (v13/*:: as any*/),
                  (v14/*:: as any*/),
                  (v15/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      (v16/*:: as any*/),
                      (v17/*:: as any*/),
                      (v6/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "spanAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]}})"
              },
              {
                "alias": "summarySpanAnnotationSummaries",
                "args": (v8/*:: as any*/),
                "concreteType": "AnnotationSummary",
                "kind": "LinkedField",
                "name": "spanAnnotationSummaries",
                "plural": true,
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
                        "name": "fraction",
                        "storageKey": null
                      },
                      (v10/*:: as any*/)
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
                  (v9/*:: as any*/)
                ],
                "storageKey": "spanAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
              },
              {
                "alias": "filteredSpanAnnotations",
                "args": [
                  {
                    "fields": [
                      {
                        "kind": "Literal",
                        "name": "exclude",
                        "value": (v7/*:: as any*/)
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
                  (v6/*:: as any*/),
                  (v9/*:: as any*/),
                  (v13/*:: as any*/),
                  (v11/*:: as any*/),
                  (v10/*:: as any*/),
                  (v12/*:: as any*/),
                  (v14/*:: as any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "SpanAnnotation",
                "kind": "LinkedField",
                "name": "spanAnnotations",
                "plural": true,
                "selections": [
                  (v6/*:: as any*/),
                  (v9/*:: as any*/),
                  (v10/*:: as any*/),
                  (v11/*:: as any*/),
                  (v12/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "metadata",
                    "storageKey": null
                  },
                  (v13/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "identifier",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "source",
                    "storageKey": null
                  },
                  (v14/*:: as any*/),
                  (v15/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      (v6/*:: as any*/),
                      (v16/*:: as any*/),
                      (v17/*:: as any*/)
                    ],
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
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanAnnotationDeleteButtonMutation",
    "selections": [
      {
        "condition": "isNote",
        "kind": "Condition",
        "passingValue": false,
        "selections": [
          {
            "alias": null,
            "args": (v4/*:: as any*/),
            "concreteType": "SpanAnnotationMutationPayload",
            "kind": "LinkedField",
            "name": "deleteSpanAnnotations",
            "plural": false,
            "selections": (v5/*:: as any*/),
            "storageKey": null
          }
        ]
      },
      {
        "condition": "isNote",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v4/*:: as any*/),
            "concreteType": "SpanAnnotationMutationPayload",
            "kind": "LinkedField",
            "name": "deleteSpanNotes",
            "plural": false,
            "selections": (v5/*:: as any*/),
            "storageKey": null
          }
        ]
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v3/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "SpanAnnotationDeleteButtonMutation",
    "selections": [
      {
        "condition": "isNote",
        "kind": "Condition",
        "passingValue": false,
        "selections": [
          {
            "alias": null,
            "args": (v4/*:: as any*/),
            "concreteType": "SpanAnnotationMutationPayload",
            "kind": "LinkedField",
            "name": "deleteSpanAnnotations",
            "plural": false,
            "selections": (v18/*:: as any*/),
            "storageKey": null
          }
        ]
      },
      {
        "condition": "isNote",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v4/*:: as any*/),
            "concreteType": "SpanAnnotationMutationPayload",
            "kind": "LinkedField",
            "name": "deleteSpanNotes",
            "plural": false,
            "selections": (v18/*:: as any*/),
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "9be32778b05a55790146287f4e92e032",
    "id": null,
    "metadata": {},
    "name": "SpanAnnotationDeleteButtonMutation",
    "operationKind": "mutation",
    "text": "mutation SpanAnnotationDeleteButtonMutation(\n  $annotationId: ID!\n  $spanId: ID!\n  $filterUserIds: [ID]\n  $isNote: Boolean!\n) {\n  deleteSpanAnnotations(input: {annotationIds: [$annotationId]}) @skip(if: $isNote) {\n    ...SpanAnnotationDeleteButton_payload\n  }\n  deleteSpanNotes(input: {annotationIds: [$annotationId]}) @include(if: $isNote) {\n    ...SpanAnnotationDeleteButton_payload\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  summarySpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}}) {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  summarySpanAnnotationSummaries: spanAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment SpanAnnotationDeleteButton_payload on SpanAnnotationMutationPayload {\n  query {\n    node(id: $spanId) {\n      __typename\n      ... on Span {\n        ...AnnotationSummaryGroup\n        ...SpanAnnotationsEditor_spanAnnotations_3lpqY\n        ...SpanAnnotationsTable_annotations\n      }\n      id\n    }\n  }\n}\n\nfragment SpanAnnotationsEditor_spanAnnotations_3lpqY on Span {\n  id\n  filteredSpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}, include: {userIds: $filterUserIds}}) {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n    createdAt\n  }\n}\n\nfragment SpanAnnotationsTable_annotations on Span {\n  id\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    metadata\n    annotatorKind\n    identifier\n    source\n    createdAt\n    updatedAt\n    user {\n      id\n      username\n      profilePictureUrl\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1a19933590ad58b959d6e44590bc5597";

export default node;
