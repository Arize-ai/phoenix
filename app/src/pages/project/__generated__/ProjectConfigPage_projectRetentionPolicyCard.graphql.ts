/**
 * @generated SignedSource<<7defc23224a16332de310129565e111e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectConfigPage_projectRetentionPolicyCard$data = {
  readonly id: string;
  readonly name: string;
  readonly traceRetentionPolicy: {
    readonly cronExpression: string;
    readonly id: string;
    readonly name: string;
    readonly rule: {
      readonly maxCount?: number;
      readonly maxDays?: number;
    };
  };
  readonly " $fragmentType": "ProjectConfigPage_projectRetentionPolicyCard";
};
export type ProjectConfigPage_projectRetentionPolicyCard$key = {
  readonly " $data"?: ProjectConfigPage_projectRetentionPolicyCard$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_projectRetentionPolicyCard">;
};

import ProjectConfigPageProjectRetentionPolicyCardQuery_graphql from './ProjectConfigPageProjectRetentionPolicyCardQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxDays",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ProjectConfigPageProjectRetentionPolicyCardQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectConfigPage_projectRetentionPolicyCard",
  "selections": [
    (v0/*: any*/),
    (v1/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "ProjectTraceRetentionPolicy",
      "kind": "LinkedField",
      "name": "traceRetentionPolicy",
      "plural": false,
      "selections": [
        (v0/*: any*/),
        (v1/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cronExpression",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "rule",
          "plural": false,
          "selections": [
            {
              "kind": "InlineFragment",
              "selections": [
                (v2/*: any*/)
              ],
              "type": "TraceRetentionRuleMaxDays",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                (v3/*: any*/)
              ],
              "type": "TraceRetentionRuleMaxCount",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                (v2/*: any*/),
                (v3/*: any*/)
              ],
              "type": "TraceRetentionRuleMaxDaysOrCount",
              "abstractKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
})();

(node as any).hash = "be41839ade0a17a6d549249abad5d6ab";

export default node;
