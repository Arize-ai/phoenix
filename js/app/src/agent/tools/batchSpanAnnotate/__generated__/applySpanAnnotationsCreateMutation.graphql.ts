/**
 * @generated SignedSource<<7a0cf3e34f216eb04fc7603dabc55345>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type CreateSpanAnnotationInput = {
  annotatorKind: AnnotatorKind;
  explanation?: string | null;
  identifier?: string | null;
  label?: string | null;
  metadata: any;
  name: string;
  score?: number | null;
  source: AnnotationSource;
  spanId: string;
};
export type applySpanAnnotationsCreateMutation$variables = {
  filterUserIds?: ReadonlyArray<string | null> | null;
  input: ReadonlyArray<CreateSpanAnnotationInput>;
};
export type applySpanAnnotationsCreateMutation$data = {
  readonly createSpanAnnotations: {
    readonly spanAnnotations: ReadonlyArray<{
      readonly span: {
        readonly __typename: "Span";
        readonly id: string;
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryGroup" | "SpanAnnotationsEditor_spanAnnotations" | "SpanAnnotationsTable_annotations">;
      };
    }>;
  };
};
export type applySpanAnnotationsCreateMutation = {
  response: applySpanAnnotationsCreateMutation$data;
  variables: applySpanAnnotationsCreateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterUserIds"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = {
  "names": [
    "note"
  ]
},
v6 = [
  {
    "kind": "Literal",
    "name": "filter",
    "value": {
      "exclude": (v5/*:: as any*/)
    }
  }
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "applySpanAnnotationsCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createSpanAnnotations",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "SpanAnnotation",
            "kind": "LinkedField",
            "name": "spanAnnotations",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "span",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "AnnotationSummaryGroup"
                  },
                  {
                    "args": [
                      {
                        "kind": "Variable",
                        "name": "filterUserIds",
                        "variableName": "filterUserIds"
                      }
                    ],
                    "kind": "FragmentSpread",
                    "name": "SpanAnnotationsEditor_spanAnnotations"
                  },
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "SpanAnnotationsTable_annotations"
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
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "applySpanAnnotationsCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createSpanAnnotations",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "SpanAnnotation",
            "kind": "LinkedField",
            "name": "spanAnnotations",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "span",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  {
                    "alias": "summarySpanAnnotations",
                    "args": (v6/*:: as any*/),
                    "concreteType": "SpanAnnotation",
                    "kind": "LinkedField",
                    "name": "spanAnnotations",
                    "plural": true,
                    "selections": [
                      (v3/*:: as any*/),
                      (v7/*:: as any*/),
                      (v8/*:: as any*/),
                      (v9/*:: as any*/),
                      (v10/*:: as any*/),
                      (v11/*:: as any*/),
                      (v12/*:: as any*/),
                      (v13/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "User",
                        "kind": "LinkedField",
                        "name": "user",
                        "plural": false,
                        "selections": [
                          (v14/*:: as any*/),
                          (v15/*:: as any*/),
                          (v3/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": "spanAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                  },
                  {
                    "alias": "summarySpanAnnotationSummaries",
                    "args": (v6/*:: as any*/),
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
                          (v8/*:: as any*/)
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
                      (v7/*:: as any*/)
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
                            "value": (v5/*:: as any*/)
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
                      (v3/*:: as any*/),
                      (v7/*:: as any*/),
                      (v11/*:: as any*/),
                      (v9/*:: as any*/),
                      (v8/*:: as any*/),
                      (v10/*:: as any*/),
                      (v12/*:: as any*/)
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
                      (v3/*:: as any*/),
                      (v7/*:: as any*/),
                      (v8/*:: as any*/),
                      (v9/*:: as any*/),
                      (v10/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "metadata",
                        "storageKey": null
                      },
                      (v11/*:: as any*/),
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
                      (v12/*:: as any*/),
                      (v13/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "User",
                        "kind": "LinkedField",
                        "name": "user",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v14/*:: as any*/),
                          (v15/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v3/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "15014cf6fb88211383c4934e515999c5",
    "id": null,
    "metadata": {},
    "name": "applySpanAnnotationsCreateMutation",
    "operationKind": "mutation",
    "text": "mutation applySpanAnnotationsCreateMutation(\n  $input: [CreateSpanAnnotationInput!]!\n  $filterUserIds: [ID]\n) {\n  createSpanAnnotations(input: $input) {\n    spanAnnotations {\n      span {\n        id\n        __typename\n        ...AnnotationSummaryGroup\n        ...SpanAnnotationsEditor_spanAnnotations_3lpqY\n        ...SpanAnnotationsTable_annotations\n      }\n      id\n    }\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  summarySpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}}) {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  summarySpanAnnotationSummaries: spanAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment SpanAnnotationsEditor_spanAnnotations_3lpqY on Span {\n  id\n  filteredSpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}, include: {userIds: $filterUserIds}}) {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n    createdAt\n  }\n}\n\nfragment SpanAnnotationsTable_annotations on Span {\n  id\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    metadata\n    annotatorKind\n    identifier\n    source\n    createdAt\n    updatedAt\n    user {\n      id\n      username\n      profilePictureUrl\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2fbc38016b4aef3c026f10dc21eddabc";

export default node;
