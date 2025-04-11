/**
 * @generated SignedSource<<b0d705867bcf3f91b61de1239325fb1e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageQueriesProjectConfigQuery$variables = {
  id: string;
};
export type ProjectPageQueriesProjectConfigQuery$data = {
  readonly project: {
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_projectConfigCard">;
  };
};
export type ProjectPageQueriesProjectConfigQuery = {
  response: ProjectPageQueriesProjectConfigQuery$data;
  variables: ProjectPageQueriesProjectConfigQuery$variables;
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageQueriesProjectConfigQuery",
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
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "ProjectConfigPage_projectConfigCard"
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
    "name": "ProjectPageQueriesProjectConfigQuery",
    "selections": [
      {
        "alias": "project",
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
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "gradientStartColor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "gradientEndColor",
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
    "cacheID": "deb9ff59e71e7fa3ec961abfe2ee6840",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQueriesProjectConfigQuery",
    "operationKind": "query",
    "text": "query ProjectPageQueriesProjectConfigQuery(\n  $id: GlobalID!\n) {\n  project: node(id: $id) {\n    __typename\n    id\n    ...ProjectConfigPage_projectConfigCard\n  }\n}\n\nfragment ProjectConfigPage_projectConfigCard on Project {\n  id\n  name\n  gradientStartColor\n  gradientEndColor\n}\n"
  }
};
})();

(node as any).hash = "5cb75a934cb351320d989b508fe89e17";

export default node;
