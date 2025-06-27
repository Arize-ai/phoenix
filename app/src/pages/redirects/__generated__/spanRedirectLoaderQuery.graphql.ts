/**
 * @generated SignedSource<<140a5bfa0ef42be2a88a2c2f31dbd2da>>
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
    readonly project: {
      readonly id: string;
    };
    readonly trace: {
      readonly id: string;
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
  "concreteType": "Trace",
  "kind": "LinkedField",
  "name": "trace",
  "plural": false,
  "selections": [
    (v2/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceId",
      "storageKey": null
    }
  ],
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
        "name": "searchSpanByOtelId",
        "plural": false,
        "selections": [
          (v3/*: any*/),
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
        "name": "searchSpanByOtelId",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/),
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8b0a16997883d754fe04488196c1a9dd",
    "id": null,
    "metadata": {},
    "name": "spanRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query spanRedirectLoaderQuery(\n  $spanOtelId: String!\n) {\n  span: searchSpanByOtelId(spanId: $spanOtelId) {\n    trace {\n      id\n      traceId\n    }\n    project {\n      id\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f08968c54f9ccc3bc9a0e5e12f3bdda6";

export default node;
