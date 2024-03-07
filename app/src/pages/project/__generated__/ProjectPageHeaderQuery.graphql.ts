/**
 * @generated SignedSource<<b86ceec32138cc2734af56d541a8afd4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageHeaderQuery$variables = {
  projectId: string;
};
export type ProjectPageHeaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeader_stats">;
};
export type ProjectPageHeaderQuery = {
  response: ProjectPageHeaderQuery$data;
  variables: ProjectPageHeaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageHeaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ProjectPageHeader_stats"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectPageHeaderQuery",
    "selections": [
      {
        "alias": "totalTraces",
        "args": [
          {
            "kind": "Literal",
            "name": "rootSpansOnly",
            "value": true
          }
        ],
        "concreteType": "SpanConnection",
        "kind": "LinkedField",
        "name": "spans",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "PageInfo",
            "kind": "LinkedField",
            "name": "pageInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "totalCount",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "spans(rootSpansOnly:true)"
      },
      {
        "alias": "project",
        "args": [
          {
            "kind": "Variable",
            "name": "id",
            "variableName": "projectId"
          }
        ],
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
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "tokenCountTotal",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "latencyMsP50",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "latencyMsP99",
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
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
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "spanEvaluationNames",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "documentEvaluationNames",
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8f5491fab41f220e2295358885e1f824",
    "id": null,
    "metadata": {},
    "name": "ProjectPageHeaderQuery",
    "operationKind": "query",
    "text": "query ProjectPageHeaderQuery(\n  $projectId: GlobalID!\n) {\n  ...ProjectPageHeader_stats\n}\n\nfragment ProjectPageHeader_stats on Query {\n  totalTraces: spans(rootSpansOnly: true) {\n    pageInfo {\n      totalCount\n    }\n  }\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      tokenCountTotal\n      latencyMsP50\n      latencyMsP99\n    }\n    __isNode: __typename\n    id\n  }\n  spanEvaluationNames\n  documentEvaluationNames\n}\n"
  }
};
})();

(node as any).hash = "5f21b34435eb35302b40edaafa608240";

export default node;
