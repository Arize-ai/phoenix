/**
 * @generated SignedSource<<c1e0fef3b607e3b1aedbf3dd56d140e6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionAnnotationsEditorDeleteAnnotationMutation$variables = {
  annotationId: string;
  sessionId: string;
};
export type SessionAnnotationsEditorDeleteAnnotationMutation$data = {
  readonly deleteProjectSessionAnnotation: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"SessionAnnotationSummaryGroup" | "SessionAnnotationsEditor_sessionAnnotations" | "SessionAnnotationsTable_annotations">;
      };
    };
  };
};
export type SessionAnnotationsEditorDeleteAnnotationMutation = {
  response: SessionAnnotationsEditorDeleteAnnotationMutation$data;
  variables: SessionAnnotationsEditorDeleteAnnotationMutation$variables;
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
  "name": "sessionId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "annotationId"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "sessionId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "confidence",
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
    "name": "SessionAnnotationsEditorDeleteAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "ProjectSessionAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "deleteProjectSessionAnnotation",
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
                "args": (v3/*:: as any*/),
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
                        "name": "SessionAnnotationsEditor_sessionAnnotations"
                      },
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "SessionAnnotationsTable_annotations"
                      },
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "SessionAnnotationSummaryGroup"
                      }
                    ],
                    "type": "ProjectSession",
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
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "SessionAnnotationsEditorDeleteAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "ProjectSessionAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "deleteProjectSessionAnnotation",
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
                "args": (v3/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ProjectSessionAnnotation",
                        "kind": "LinkedField",
                        "name": "sessionAnnotations",
                        "plural": true,
                        "selections": [
                          (v5/*:: as any*/),
                          (v6/*:: as any*/),
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
                          (v7/*:: as any*/),
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
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "user",
                            "plural": false,
                            "selections": [
                              (v5/*:: as any*/),
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
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "metadata",
                            "storageKey": null
                          },
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
                            "concreteType": "DecisionAnnotation",
                            "kind": "LinkedField",
                            "name": "decision",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "status",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "DecisionAnnotationQuestion",
                                "kind": "LinkedField",
                                "name": "question",
                                "plural": false,
                                "selections": [
                                  (v6/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "type",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DecisionChoiceOption",
                                    "kind": "LinkedField",
                                    "name": "choices",
                                    "plural": true,
                                    "selections": [
                                      (v8/*:: as any*/),
                                      (v9/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DecisionScaleLevel",
                                    "kind": "LinkedField",
                                    "name": "levels",
                                    "plural": true,
                                    "selections": [
                                      (v7/*:: as any*/),
                                      (v9/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "answer",
                                "plural": false,
                                "selections": [
                                  (v4/*:: as any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v10/*:: as any*/)
                                    ],
                                    "type": "PredicateAnswer",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "choice",
                                        "storageKey": null
                                      },
                                      (v11/*:: as any*/),
                                      {
                                        "alias": "choiceProbabilities",
                                        "args": null,
                                        "concreteType": "ChoiceProbability",
                                        "kind": "LinkedField",
                                        "name": "probabilities",
                                        "plural": true,
                                        "selections": [
                                          (v8/*:: as any*/),
                                          (v10/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "ChoiceAnswer",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "expectedLevel",
                                        "storageKey": null
                                      },
                                      (v11/*:: as any*/),
                                      {
                                        "alias": "levelProbabilities",
                                        "args": null,
                                        "concreteType": "LevelProbability",
                                        "kind": "LinkedField",
                                        "name": "probabilities",
                                        "plural": true,
                                        "selections": [
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "level",
                                            "storageKey": null
                                          },
                                          (v10/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "ScaleAnswer",
                                    "abstractKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "requestedModel",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "resolvedModel",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "modelProvider",
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
                              (v7/*:: as any*/)
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
                          (v6/*:: as any*/)
                        ],
                        "storageKey": "sessionAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                      }
                    ],
                    "type": "ProjectSession",
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
    "cacheID": "b8448df66353b2f3ae01f5d2a1153f39",
    "id": null,
    "metadata": {},
    "name": "SessionAnnotationsEditorDeleteAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation SessionAnnotationsEditorDeleteAnnotationMutation(\n  $sessionId: ID!\n  $annotationId: ID!\n) {\n  deleteProjectSessionAnnotation(id: $annotationId) {\n    query {\n      node(id: $sessionId) {\n        __typename\n        ... on ProjectSession {\n          ...SessionAnnotationsEditor_sessionAnnotations\n          ...SessionAnnotationsTable_annotations\n          ...SessionAnnotationSummaryGroup\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment SessionAnnotationSummaryGroup on ProjectSession {\n  sessionAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n    decision {\n      status\n      question {\n        name\n        type\n        choices {\n          value\n          description\n        }\n        levels {\n          label\n          description\n        }\n      }\n      answer {\n        __typename\n        ... on PredicateAnswer {\n          probability\n        }\n        ... on ChoiceAnswer {\n          choice\n          confidence\n          choiceProbabilities: probabilities {\n            value\n            probability\n          }\n        }\n        ... on ScaleAnswer {\n          expectedLevel\n          confidence\n          levelProbabilities: probabilities {\n            level\n            probability\n          }\n        }\n      }\n      requestedModel\n      resolvedModel\n      modelProvider\n    }\n  }\n  summarySessionAnnotationSummaries: sessionAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment SessionAnnotationsEditor_sessionAnnotations on ProjectSession {\n  id\n  sessionAnnotations {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n    createdAt\n    user {\n      id\n      username\n      profilePictureUrl\n    }\n  }\n}\n\nfragment SessionAnnotationsTable_annotations on ProjectSession {\n  id\n  sessionAnnotations {\n    id\n    name\n    label\n    score\n    explanation\n    metadata\n    annotatorKind\n    identifier\n    source\n    createdAt\n    updatedAt\n    user {\n      id\n      username\n      profilePictureUrl\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ff722246a009421e1e1db10ac0c51c97";

export default node;
