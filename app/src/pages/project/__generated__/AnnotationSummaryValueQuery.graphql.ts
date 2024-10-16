/**
 * @generated SignedSource<<a28f307bbb6ee378e96db883fa35ffee>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeRange = {
  end: string;
  start: string;
};
export type AnnotationSummaryValueQuery$variables = {
  annotationName: string;
  id: string;
  timeRange: TimeRange;
};
export type AnnotationSummaryValueQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryValueFragment">;
  };
};
export type AnnotationSummaryValueQuery = {
  response: AnnotationSummaryValueQuery$data;
  variables: AnnotationSummaryValueQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "annotationName"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v4 = [
  {
    "kind": "Variable",
    "name": "annotationName",
    "variableName": "annotationName"
  },
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "AnnotationSummaryValueQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": (v4/*: any*/),
            "kind": "FragmentSpread",
            "name": "AnnotationSummaryValueFragment"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v2/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "AnnotationSummaryValueQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v4/*: any*/),
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
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "bae90b7000aa37d37050070d8504b41c",
    "id": null,
    "metadata": {},
    "name": "AnnotationSummaryValueQuery",
    "operationKind": "query",
    "text": "query AnnotationSummaryValueQuery(\n  $annotationName: String!\n  $timeRange: TimeRange!\n  $id: GlobalID!\n) {\n  node(id: $id) {\n    __typename\n    ...AnnotationSummaryValueFragment_4BTVrq\n    __isNode: __typename\n    id\n  }\n}\n\nfragment AnnotationSummaryValueFragment_4BTVrq on Project {\n  spanAnnotationSummary(annotationName: $annotationName, timeRange: $timeRange) {\n    labelFractions {\n      label\n      fraction\n    }\n    meanScore\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "0a8e190e4d87acc87c161366f330e3af";

export default node;
