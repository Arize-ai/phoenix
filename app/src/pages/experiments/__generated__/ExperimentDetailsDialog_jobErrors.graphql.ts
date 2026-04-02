/**
 * @generated SignedSource<<2d509312a4fee45cfc908fbdb90e84b7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ExperimentErrorCategory = "EVAL" | "EXPERIMENT" | "TASK";
import { FragmentRefs } from "relay-runtime";
export type ExperimentDetailsDialog_jobErrors$data = {
  readonly errors: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly category: ExperimentErrorCategory;
        readonly detail: {
          readonly errorType?: string;
          readonly reason?: string;
          readonly retryCount?: number;
          readonly stackTrace?: string | null;
        } | null;
        readonly id: string;
        readonly message: string;
        readonly occurredAt: string;
      };
    }>;
    readonly pageInfo: {
      readonly endCursor: string | null;
      readonly hasNextPage: boolean;
    };
  };
  readonly id: string;
  readonly " $fragmentType": "ExperimentDetailsDialog_jobErrors";
};
export type ExperimentDetailsDialog_jobErrors$key = {
  readonly " $data"?: ExperimentDetailsDialog_jobErrors$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentDetailsDialog_jobErrors">;
};

import ExperimentDetailsDialogJobErrorsQuery_graphql from './ExperimentDetailsDialogJobErrorsQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "errors"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stackTrace",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "kind": "RootArgument",
      "name": "errorsAfter"
    },
    {
      "kind": "RootArgument",
      "name": "errorsFirst"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "errorsFirst",
        "cursor": "errorsAfter",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "errorsFirst",
          "cursor": "errorsAfter"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ExperimentDetailsDialogJobErrorsQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ExperimentDetailsDialog_jobErrors",
  "selections": [
    {
      "alias": "errors",
      "args": null,
      "concreteType": "ExperimentErrorConnection",
      "kind": "LinkedField",
      "name": "__ExperimentDetailsDialog_errors_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ExperimentErrorEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "ExperimentError",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "occurredAt",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "category",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "message",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "detail",
                  "plural": false,
                  "selections": [
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "errorType",
                          "storageKey": null
                        },
                        (v2/*: any*/)
                      ],
                      "type": "FailureDetail",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "retryCount",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "reason",
                          "storageKey": null
                        },
                        (v2/*: any*/)
                      ],
                      "type": "RetriesExhaustedDetail",
                      "abstractKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
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
              "name": "hasNextPage",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endCursor",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    (v1/*: any*/)
  ],
  "type": "ExperimentJob",
  "abstractKey": null
};
})();

(node as any).hash = "d4a2296c001af88d92ab225a6bd5d18a";

export default node;
