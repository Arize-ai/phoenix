/**
 * @generated SignedSource<<888d641fef5dc4a8968fdc2a906816f2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotatorKind = "HUMAN" | "LLM";
export type SpanAnnotationsEditorNewAnnotationQuery$variables = {
  projectId: string;
  spanId: string;
};
export type SpanAnnotationsEditorNewAnnotationQuery$data = {
  readonly project: {
    readonly id: string;
    readonly spanAnnotationNames?: ReadonlyArray<string>;
  };
  readonly span: {
    readonly id: string;
    readonly spanAnnotations?: ReadonlyArray<{
      readonly annotatorKind: AnnotatorKind;
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type SpanAnnotationsEditorNewAnnotationQuery = {
  response: SpanAnnotationsEditorNewAnnotationQuery$data;
  variables: SpanAnnotationsEditorNewAnnotationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  },
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
    "variableName": "projectId"
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
      "kind": "ScalarField",
      "name": "spanAnnotationNames",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v5 = {
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanAnnotationsEditorNewAnnotationQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "span",
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v5/*: any*/)
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
    "name": "SpanAnnotationsEditorNewAnnotationQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "span",
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          (v2/*: any*/),
          (v5/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "6326a507f51a809d4e904939e6fb0d42",
    "id": null,
    "metadata": {},
    "name": "SpanAnnotationsEditorNewAnnotationQuery",
    "operationKind": "query",
    "text": "query SpanAnnotationsEditorNewAnnotationQuery(\n  $projectId: GlobalID!\n  $spanId: GlobalID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    id\n    ... on Project {\n      spanAnnotationNames\n    }\n  }\n  span: node(id: $spanId) {\n    __typename\n    id\n    ... on Span {\n      spanAnnotations {\n        id\n        name\n        annotatorKind\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d513b2aaa49d0041d01c4f98f89c15b2";

export default node;
