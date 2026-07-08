/**
 * @generated SignedSource<<0e33c5bf0a44913d025f26ec42d68b1f>>
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
  "metadata": null,
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

(node as any).hash = "6069a92b50f5083a8c8fbeee6982b6b5";

export default node;
