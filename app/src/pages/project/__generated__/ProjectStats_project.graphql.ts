/**
 * @generated SignedSource<<2ffdfcd350fb0d316a81e4f6e58f220d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectStats_project$data = {
  readonly costSummary: {
    readonly completion: {
      readonly cost: number | null;
    };
    readonly prompt: {
      readonly cost: number | null;
    };
    readonly total: {
      readonly cost: number | null;
    };
  };
  readonly documentEvaluationNames: ReadonlyArray<string>;
  readonly id: string;
  readonly latencyMsP50: number | null;
  readonly latencyMsP99: number | null;
  readonly spanAnnotationNames: ReadonlyArray<string>;
  readonly timeRangeTraceCount: number;
  readonly " $fragmentType": "ProjectStats_project";
};
export type ProjectStats_project$key = {
  readonly " $data"?: ProjectStats_project$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectStats_project">;
};

import ProjectStatsQuery_graphql from './ProjectStatsQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v1 = [
  (v0/*: any*/)
],
v2 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
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
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ProjectStatsQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectStats_project",
  "selections": [
    {
      "alias": "timeRangeTraceCount",
      "args": (v1/*: any*/),
      "kind": "ScalarField",
      "name": "traceCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v1/*: any*/),
      "concreteType": "SpanCostSummary",
      "kind": "LinkedField",
      "name": "costSummary",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "total",
          "plural": false,
          "selections": (v2/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "prompt",
          "plural": false,
          "selections": (v2/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "completion",
          "plural": false,
          "selections": (v2/*: any*/),
          "storageKey": null
        }
      ],
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
      "alias": "latencyMsP99",
      "args": [
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.99
        },
        (v0/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "latencyMsQuantile",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanAnnotationNames",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "documentEvaluationNames",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
})();

(node as any).hash = "c81b99ab1904f209b6f4194123e9fb99";

export default node;
