/**
 * @generated SignedSource<<6610f4569994b3db4da90451c90a1bf8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectRetentionPolicyCard_policy$data = {
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
  readonly " $fragmentType": "ProjectRetentionPolicyCard_policy";
};
export type ProjectRetentionPolicyCard_policy$key = {
  readonly " $data"?: ProjectRetentionPolicyCard_policy$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectRetentionPolicyCard_policy">;
};

import ProjectRetentionPolicyCardQuery_graphql from './ProjectRetentionPolicyCardQuery.graphql';

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
      "operation": ProjectRetentionPolicyCardQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectRetentionPolicyCard_policy",
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

(node as any).hash = "4fa3fab109a0fda0beab65fa1fcfb590";

export default node;
