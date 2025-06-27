/**
 * @generated SignedSource<<f2be308f938fb02c817b74e178a223e6>>
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": "span",
    "args": [
      {
        "kind": "Variable",
        "name": "spanId",
        "variableName": "spanOtelId"
      }
    ],
    "concreteType": "Span",
    "kind": "LinkedField",
    "name": "getSpanByOtelId",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "Trace",
        "kind": "LinkedField",
        "name": "trace",
        "plural": false,
        "selections": [
          (v1/*: any*/),
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
      {
        "alias": null,
        "args": null,
        "concreteType": "Project",
        "kind": "LinkedField",
        "name": "project",
        "plural": false,
        "selections": [
          (v1/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "spanRedirectLoaderQuery",
    "selections": (v2/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "spanRedirectLoaderQuery",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "78e356ab24f3b9af35b23a6d6f934937",
    "id": null,
    "metadata": {},
    "name": "spanRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query spanRedirectLoaderQuery(\n  $spanOtelId: String!\n) {\n  span: getSpanByOtelId(spanId: $spanOtelId) {\n    id\n    trace {\n      id\n      traceId\n    }\n    project {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "39d4d65a07ea9899ffa3ef7a64054c05";

export default node;
