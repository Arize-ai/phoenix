/**
 * @generated SignedSource<<486274aaa402dfbe49e8cf5c24bce557>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type spanRedirectLoaderQuery$variables = {
  spanOtelId: string;
};
export type spanRedirectLoaderQuery$data = {
  readonly span: {
    readonly id: string;
    readonly project: {
      readonly id: string;
    };
    readonly trace: {
      readonly traceId: string;
    };
  } | null;
};
export type spanRedirectLoaderQuery = {
  response: spanRedirectLoaderQuery$data;
  variables: spanRedirectLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanOtelId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "spanId",
    "variableName": "spanOtelId"
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v2/*: any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "spanRedirectLoaderQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
        "concreteType": "Span",
        "kind": "LinkedField",
        "name": "getSpanByOtelId",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Trace",
            "kind": "LinkedField",
            "name": "trace",
            "plural": false,
            "selections": [
              (v3/*: any*/)
            ],
            "storageKey": null
          },
          (v4/*: any*/)
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
    "name": "spanRedirectLoaderQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
        "concreteType": "Span",
        "kind": "LinkedField",
        "name": "getSpanByOtelId",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Trace",
            "kind": "LinkedField",
            "name": "trace",
            "plural": false,
            "selections": [
              (v3/*: any*/),
              (v2/*: any*/)
            ],
            "storageKey": null
          },
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2985bb05472ca7556d8aa675123a98e3",
    "id": null,
    "metadata": {},
    "name": "spanRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query spanRedirectLoaderQuery(\n  $spanOtelId: String!\n) {\n  span: getSpanByOtelId(spanId: $spanOtelId) {\n    id\n    trace {\n      traceId\n      id\n    }\n    project {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a80ec47ffd0bc1b23a4641393a324120";

export default node;
