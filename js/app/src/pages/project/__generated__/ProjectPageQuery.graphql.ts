/**
 * @generated SignedSource<<cafdaf17baf883780c325307f6d7be8b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageQuery$variables = {
  id: string;
};
export type ProjectPageQuery$data = {
  readonly project: {
    readonly evaluatorCount?: number;
    readonly isClearingTraces?: boolean;
    readonly " $fragmentSpreads": FragmentRefs<"ProjectOnboardingOverlay_project" | "ProjectTimeRangeControls_data">;
  };
};
export type ProjectPageQuery = {
  response: ProjectPageQuery$data;
  variables: ProjectPageQuery$variables;
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
  "name": "evaluatorCount",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isClearingTraces",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "ProjectTimeRangeControls_data"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "ProjectOnboardingOverlay_project"
              }
            ],
            "type": "Project",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProjectPageQuery",
    "selections": [
      {
        "alias": "project",
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
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "streamingLastUpdatedAt",
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
                "name": "hasTraces",
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
    "cacheID": "6ebd21c7f0937ed1411885208fb4ec24",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQuery",
    "operationKind": "query",
    "text": "query ProjectPageQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      evaluatorCount\n      isClearingTraces\n      ...ProjectTimeRangeControls_data\n      ...ProjectOnboardingOverlay_project\n    }\n    id\n  }\n}\n\nfragment ProjectOnboardingOverlay_project on Project {\n  name\n  hasTraces\n  id\n}\n\nfragment ProjectTimeRangeControls_data on Project {\n  streamingLastUpdatedAt\n  isClearingTraces\n  id\n}\n"
  }
};
})();

(node as any).hash = "94063a809350fd0b6b980c4e386a7302";

export default node;
