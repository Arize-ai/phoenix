/**
 * @generated SignedSource<<ca1aeb7a5b9718ea39c48fa1999c08f1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type AnnotatorKind = "HUMAN" | "LLM";
export type TraceHeaderRootSpanAnnotationsQuery$variables = {
  id: string;
};
export type TraceHeaderRootSpanAnnotationsQuery$data = {
  readonly span: {
    readonly spanAnnotations?: ReadonlyArray<{
      readonly annotatorKind: AnnotatorKind;
      readonly label: string | null;
      readonly name: string;
      readonly score: number | null;
    }>;
  };
};
export type TraceHeaderRootSpanAnnotationsQuery = {
  response: TraceHeaderRootSpanAnnotationsQuery$data;
  variables: TraceHeaderRootSpanAnnotationsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
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
          "name": "label",
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
          "name": "annotatorKind",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TraceHeaderRootSpanAnnotationsQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/)
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
    "name": "TraceHeaderRootSpanAnnotationsQuery",
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
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "72a83342701c8636f9f95241c5f879e6",
    "id": null,
    "metadata": {},
    "name": "TraceHeaderRootSpanAnnotationsQuery",
    "operationKind": "query",
    "text": "query TraceHeaderRootSpanAnnotationsQuery(\n  $id: GlobalID!\n) {\n  span: node(id: $id) {\n    __typename\n    ... on Span {\n      spanAnnotations {\n        name\n        label\n        score\n        annotatorKind\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "6c3505c6379d4b0066df22d2599c1c0f";

export default node;
