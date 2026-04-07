/**
 * @generated SignedSource<<3444e41e30646389acde70ced704e77c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ExperimentLogCategory = "EVAL" | "EXPERIMENT" | "TASK";
import { FragmentRefs } from "relay-runtime";
export type ExperimentDetailsDialog_jobErrors$data = {
  readonly errors: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly category: ExperimentLogCategory;
        readonly detail: {
          readonly __typename: "FailureDetail";
          readonly errorType: string;
          readonly workItem: {
            readonly __typename: "EvalWorkItemId";
            readonly datasetEvaluatorId: number;
            readonly experimentRunId: number;
          } | {
            readonly __typename: "TaskWorkItemId";
            readonly datasetExampleId: number;
            readonly repetitionNumber: number;
          } | {
            // This will never be '%other', but we need some
            // value in case none of the concrete values match.
            readonly __typename: "%other";
          } | null;
        } | {
          readonly __typename: "RetriesExhaustedDetail";
          readonly reason: string;
          readonly retryCount: number;
          readonly workItem: {
            readonly __typename: "EvalWorkItemId";
            readonly datasetEvaluatorId: number;
            readonly experimentRunId: number;
          } | {
            readonly __typename: "TaskWorkItemId";
            readonly datasetExampleId: number;
            readonly repetitionNumber: number;
          } | {
            // This will never be '%other', but we need some
            // value in case none of the concrete values match.
            readonly __typename: "%other";
          } | null;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
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
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "workItem",
  "plural": false,
  "selections": [
    (v2/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "datasetExampleId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "repetitionNumber",
          "storageKey": null
        }
      ],
      "type": "TaskWorkItemId",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "experimentRunId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "datasetEvaluatorId",
          "storageKey": null
        }
      ],
      "type": "EvalWorkItemId",
      "abstractKey": null
    }
  ],
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
      "concreteType": "ExperimentLogConnection",
      "kind": "LinkedField",
      "name": "__ExperimentDetailsDialog_errors_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ExperimentLogEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "ExperimentLog",
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
                    (v2/*: any*/),
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
                        (v3/*: any*/)
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
                        (v3/*: any*/)
                      ],
                      "type": "RetriesExhaustedDetail",
                      "abstractKey": null
                    }
                  ],
                  "storageKey": null
                },
                (v2/*: any*/)
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

(node as any).hash = "fad0bb1898b095765731ad5f980c0017";

export default node;
