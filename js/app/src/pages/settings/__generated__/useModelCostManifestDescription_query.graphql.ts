/**
 * @generated SignedSource<<1c75d6fcb97925a6aa4b24dcc53d48bf>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type useModelCostManifestDescription_query$data = {
  readonly modelCostManifest: {
    readonly generatedAt: string;
  } | null;
  readonly " $fragmentType": "useModelCostManifestDescription_query";
};
export type useModelCostManifestDescription_query$key = {
  readonly " $data"?: useModelCostManifestDescription_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"useModelCostManifestDescription_query">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "useModelCostManifestDescription_query",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ModelCostManifest",
      "kind": "LinkedField",
      "name": "modelCostManifest",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "generatedAt",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "f9af38b5e7442c524bc438bbe36ca521";

export default node;
