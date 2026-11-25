/**
 * @generated SignedSource<<e31e39fef95d27bec862218771376aab>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useProjectEvaluatorGalleryRegistrationQuery$variables = {
  projectId: string;
};
export type useProjectEvaluatorGalleryRegistrationQuery$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly evaluator: {
        readonly __typename: string;
        readonly description: string | null;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type useProjectEvaluatorGalleryRegistrationQuery = {
  response: useProjectEvaluatorGalleryRegistrationQuery$data;
  variables: useProjectEvaluatorGalleryRegistrationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "excludeProjectId",
        "variableName": "projectId"
      },
      {
        "kind": "Literal",
        "name": "first",
        "value": 100
      },
      {
        "kind": "Literal",
        "name": "sort",
        "value": {
          "col": "updatedAt",
          "dir": "desc"
        }
      }
    ],
    "concreteType": "EvaluatorConnection",
    "kind": "LinkedField",
    "name": "evaluators",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "EvaluatorEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": "evaluator",
            "args": null,
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
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
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
                "name": "description",
                "storageKey": null
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useProjectEvaluatorGalleryRegistrationQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useProjectEvaluatorGalleryRegistrationQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "f1a99d95239342f1b8a3fcea4794c296",
    "id": null,
    "metadata": {},
    "name": "useProjectEvaluatorGalleryRegistrationQuery",
    "operationKind": "query",
    "text": "query useProjectEvaluatorGalleryRegistrationQuery(\n  $projectId: ID!\n) {\n  evaluators(first: 100, sort: {col: updatedAt, dir: desc}, excludeProjectId: $projectId) {\n    edges {\n      evaluator: node {\n        __typename\n        id\n        name\n        description\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0cf5278415166618addd74e49dfb3408";

export default node;
