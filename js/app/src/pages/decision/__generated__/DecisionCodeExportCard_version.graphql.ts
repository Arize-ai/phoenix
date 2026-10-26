/**
 * @generated SignedSource<<6607d32784b1a80e0b2c6388872bb67e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionCodeExportCard_version$data = {
  readonly id: string;
  readonly inputs: ReadonlyArray<{
    readonly name: string;
  }>;
  readonly " $fragmentType": "DecisionCodeExportCard_version";
};
export type DecisionCodeExportCard_version$key = {
  readonly " $data"?: DecisionCodeExportCard_version$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionCodeExportCard_version">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionCodeExportCard_version",
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
      "concreteType": "DecisionInputDefinition",
      "kind": "LinkedField",
      "name": "inputs",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DecisionVersion",
  "abstractKey": null
};

(node as any).hash = "0a30e2c5909a77f49a9f350ab89eda3c";

export default node;
