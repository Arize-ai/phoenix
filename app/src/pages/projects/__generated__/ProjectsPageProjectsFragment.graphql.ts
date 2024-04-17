/**
 * @generated SignedSource<<260c2f50f9cb857944f365304ec667e3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectsPageProjectsFragment$data = {
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly project: {
        readonly endTime: string | null;
        readonly id: string;
        readonly latencyMsP50: number | null;
        readonly name: string;
        readonly tokenCountTotal: number;
        readonly traceCount: number;
      };
    }>;
  };
  readonly " $fragmentType": "ProjectsPageProjectsFragment";
};
export type ProjectsPageProjectsFragment$key = {
  readonly " $data"?: ProjectsPageProjectsFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectsPageProjectsFragment">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v1 = [
  (v0/*: any*/)
];
return {
  "argumentDefinitions": [
    {
      "kind": "RootArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": require('./ProjectsPageProjectsQuery.graphql')
    }
  },
  "name": "ProjectsPageProjectsFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ProjectConnection",
      "kind": "LinkedField",
      "name": "projects",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ProjectEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "project",
              "args": null,
              "concreteType": "Project",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
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
                  "args": (v1/*: any*/),
                  "kind": "ScalarField",
                  "name": "traceCount",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "endTime",
                  "storageKey": null
                },
                {
                  "alias": "latencyMsP50",
                  "args": [
                    {
                      "kind": "Literal",
                      "name": "probability",
                      "value": 0.5
                    },
                    (v0/*: any*/)
                  ],
                  "kind": "ScalarField",
                  "name": "latencyMsQuantile",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": (v1/*: any*/),
                  "kind": "ScalarField",
                  "name": "tokenCountTotal",
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
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "80cfac4a7e56fc862924dce5da4ed971";

export default node;
