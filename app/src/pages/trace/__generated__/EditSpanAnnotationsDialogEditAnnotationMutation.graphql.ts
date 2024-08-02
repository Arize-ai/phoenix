/**
 * @generated SignedSource<<a3050d463183f8b463119d6ce9c5efa8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeRange = {
  end: string;
  start: string;
};
export type EditSpanAnnotationsDialogEditAnnotationMutation$variables = {
  annotationId: string;
  explanation?: string | null;
  label?: string | null;
  name: string;
  projectId: string;
  score?: number | null;
  spanId: string;
  timeRange: TimeRange;
};
export type EditSpanAnnotationsDialogEditAnnotationMutation$data = {
  readonly patchSpanAnnotations: {
    readonly query: {
      readonly project: {
        readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryValueFragment">;
      };
      readonly span: {
        readonly " $fragmentSpreads": FragmentRefs<"EditSpanAnnotationsDialog_spanAnnotations">;
      };
    };
  };
};
export type EditSpanAnnotationsDialogEditAnnotationMutation = {
  response: EditSpanAnnotationsDialogEditAnnotationMutation$data;
  variables: EditSpanAnnotationsDialogEditAnnotationMutation$variables;
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
  "name": "projectId"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "score"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "spanId"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v8 = [
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
v9 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v10 = [
  {
    "kind": "Variable",
    "name": "annotationName",
    "variableName": "name"
  },
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v11 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v13 = {
  "kind": "TypeDiscriminator",
  "abstractKey": "__isNode"
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
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
      (v5/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditSpanAnnotationsDialogEditAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v8/*: any*/),
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
                "alias": "project",
                "args": (v9/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "args": (v10/*: any*/),
                    "kind": "FragmentSpread",
                    "name": "AnnotationSummaryValueFragment"
                  }
                ],
                "storageKey": null
              },
              {
                "alias": "span",
                "args": (v11/*: any*/),
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
    "argumentDefinitions": [
      (v6/*: any*/),
      (v4/*: any*/),
      (v7/*: any*/),
      (v0/*: any*/),
      (v3/*: any*/),
      (v2/*: any*/),
      (v5/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "EditSpanAnnotationsDialogEditAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v8/*: any*/),
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
                "alias": "project",
                "args": (v9/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v12/*: any*/),
                  (v13/*: any*/),
                  (v14/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": (v10/*: any*/),
                        "concreteType": "AnnotationSummary",
                        "kind": "LinkedField",
                        "name": "spanAnnotationSummary",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "LabelFraction",
                            "kind": "LinkedField",
                            "name": "labelFractions",
                            "plural": true,
                            "selections": [
                              (v15/*: any*/),
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
                  }
                ],
                "storageKey": null
              },
              {
                "alias": "span",
                "args": (v11/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v12/*: any*/),
                  (v13/*: any*/),
                  (v14/*: any*/),
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
                          (v14/*: any*/),
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
                          (v15/*: any*/),
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
    "cacheID": "1763b9de41d82e91c2055a79f292f352",
    "id": null,
    "metadata": {},
    "name": "EditSpanAnnotationsDialogEditAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation EditSpanAnnotationsDialogEditAnnotationMutation(\n  $spanId: GlobalID!\n  $projectId: GlobalID!\n  $timeRange: TimeRange!\n  $annotationId: GlobalID!\n  $name: String!\n  $label: String\n  $score: Float\n  $explanation: String\n) {\n  patchSpanAnnotations(input: [{annotationId: $annotationId, name: $name, label: $label, score: $score, explanation: $explanation, annotatorKind: HUMAN}]) {\n    query {\n      project: node(id: $projectId) {\n        __typename\n        ...AnnotationSummaryValueFragment_20r1YH\n        __isNode: __typename\n        id\n      }\n      span: node(id: $spanId) {\n        __typename\n        ... on Span {\n          ...EditSpanAnnotationsDialog_spanAnnotations\n        }\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n\nfragment AnnotationSummaryValueFragment_20r1YH on Project {\n  spanAnnotationSummary(annotationName: $name, timeRange: $timeRange) {\n    labelFractions {\n      label\n      fraction\n    }\n    meanScore\n  }\n  id\n}\n\nfragment EditSpanAnnotationsDialog_spanAnnotations on Span {\n  id\n  spanAnnotations {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n  }\n}\n"
  }
};
})();

(node as any).hash = "0bf7a927d5de8be112690eadda3db419";

export default node;
