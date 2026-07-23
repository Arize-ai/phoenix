/**
 * @generated SignedSource<<21078c4c5051adce62076b8135f48c22>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EditAgentSessionTitleDialog_session$data = {
  readonly id: string;
  readonly title: string;
  readonly " $fragmentType": "EditAgentSessionTitleDialog_session";
};
export type EditAgentSessionTitleDialog_session$key = {
  readonly " $data"?: EditAgentSessionTitleDialog_session$data;
  readonly " $fragmentSpreads": FragmentRefs<"EditAgentSessionTitleDialog_session">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "EditAgentSessionTitleDialog_session",
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
      "name": "title",
      "storageKey": null
    }
  ],
  "type": "AgentSession",
  "abstractKey": null
};

(node as any).hash = "779f5510101ca32616d33064e364d9a6";

export default node;
