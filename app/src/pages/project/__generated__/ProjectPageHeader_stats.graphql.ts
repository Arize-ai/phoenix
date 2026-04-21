/**
 * @generated SignedSource<<a9310b45477e9c54d04e81e2eb50a870>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageHeader_stats$data = {
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
  readonly " $fragmentType": "ProjectPageHeader_stats";
};
export type ProjectPageHeader_stats$key = {
  readonly " $data"?: ProjectPageHeader_stats$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeader_stats">;
};

import ProjectPageHeaderQuery_graphql from './ProjectPageHeaderQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "kind": "Variable",
  "name": "filterCondition",
  "variableName": "filterCondition"
},
v1 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v2 = [
  (v0/*: any*/),
  (v1/*: any*/)
],
v3 = [
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
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filterCondition"
    },
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
      "operation": ProjectPageHeaderQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectPageHeader_stats",
  "selections": [
    {
      "alias": "timeRangeTraceCount",
      "args": (v2/*: any*/),
      "kind": "ScalarField",
      "name": "traceCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v2/*: any*/),
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
          "selections": (v3/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "prompt",
          "plural": false,
          "selections": (v3/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "completion",
          "plural": false,
          "selections": (v3/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": "latencyMsP50",
      "args": [
        (v0/*: any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.5
        },
        (v1/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "latencyMsQuantile",
      "storageKey": null
    },
    {
      "alias": "latencyMsP99",
      "args": [
        (v0/*: any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.99
        },
        (v1/*: any*/)
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

(node as any).hash = "6af66e172d4a11818131c7b943e82a6d";

export default node;
