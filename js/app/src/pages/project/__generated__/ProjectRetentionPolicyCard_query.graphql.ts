/**
 * @generated SignedSource<<f3c9643df06ca3ff37b4c450f76be8ed>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectRetentionPolicyCard_query$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ProjectTraceRetentionPolicySelectFragment">;
  readonly " $fragmentType": "ProjectRetentionPolicyCard_query";
};
export type ProjectRetentionPolicyCard_query$key = {
  readonly " $data"?: ProjectRetentionPolicyCard_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectRetentionPolicyCard_query">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectRetentionPolicyCard_query",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ProjectTraceRetentionPolicySelectFragment"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "ae8f95394a5ca83acf7326a90809b351";

export default node;
