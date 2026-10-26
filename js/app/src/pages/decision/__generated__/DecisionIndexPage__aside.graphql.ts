/**
 * @generated SignedSource<<beb2d05e963d1a36d998e1485262e1bc>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionIndexPage__aside$data = {
  readonly description: string | null;
  readonly id: string;
  readonly metadata: any;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLabels" | "DecisionLatestVersionsListFragment" | "EditDecisionButton_data">;
  readonly " $fragmentType": "DecisionIndexPage__aside";
};
export type DecisionIndexPage__aside$key = {
  readonly " $data"?: DecisionIndexPage__aside$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionIndexPage__aside">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionIndexPage__aside",
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
      "name": "description",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "metadata",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "DecisionLatestVersionsListFragment"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "EditDecisionButton_data"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "DecisionLabels"
    }
  ],
  "type": "Decision",
  "abstractKey": null
};

(node as any).hash = "0250010816ee0166918c70270cf254fe";

export default node;
