/**
 * @generated SignedSource<<b9d14d00e8063a90a9b3ca66d167515a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useSpanAnnotationCountsQuery$variables = {
  id: string;
};
export type useSpanAnnotationCountsQuery$data = {
  readonly span: {
    readonly spanAnnotations?: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type useSpanAnnotationCountsQuery = {
  response: useSpanAnnotationCountsQuery$data;
  variables: useSpanAnnotationCountsQuery$variables;
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
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
        (v2/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useSpanAnnotationCountsQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useSpanAnnotationCountsQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*:: as any*/),
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
          (v3/*:: as any*/),
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8994057f59d2b5ff60c748601a8859b5",
    "id": null,
    "metadata": {},
    "name": "useSpanAnnotationCountsQuery",
    "operationKind": "query",
    "text": "query useSpanAnnotationCountsQuery(\n  $id: ID!\n) {\n  span: node(id: $id) {\n    __typename\n    ... on Span {\n      spanAnnotations {\n        id\n        name\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "d8f30a6a8ba14bf95ea55efcafa69aa1";

export default node;
