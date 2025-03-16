/**
 * @generated SignedSource<<67f81d12c748c56c71359d18cc6e5cb4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EditSpanAnnotationsDialogQuery$variables = {
  spanId: string;
};
export type EditSpanAnnotationsDialogQuery$data = {
  readonly span: {
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"EditSpanAnnotationsDialog_spanAnnotations">;
  };
};
export type EditSpanAnnotationsDialogQuery = {
  response: EditSpanAnnotationsDialogQuery$data;
  variables: EditSpanAnnotationsDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v2 = {
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
    "name": "EditSpanAnnotationsDialogQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
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
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditSpanAnnotationsDialogQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
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
          (v2/*: any*/),
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
                  (v2/*: any*/),
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
    ]
  },
  "params": {
    "cacheID": "fa9009e21fe4c676b813c273c48d2f55",
    "id": null,
    "metadata": {},
    "name": "EditSpanAnnotationsDialogQuery",
    "operationKind": "query",
    "text": "query EditSpanAnnotationsDialogQuery(\n  $spanId: ID!\n) {\n  span: node(id: $spanId) {\n    __typename\n    id\n    ... on Span {\n      ...EditSpanAnnotationsDialog_spanAnnotations\n    }\n  }\n}\n\nfragment EditSpanAnnotationsDialog_spanAnnotations on Span {\n  id\n  spanAnnotations {\n    id\n    name\n    annotatorKind\n    score\n    label\n    explanation\n  }\n}\n"
  }
};
})();

(node as any).hash = "0780096641c37c465b08fb8b0838a461";

export default node;
