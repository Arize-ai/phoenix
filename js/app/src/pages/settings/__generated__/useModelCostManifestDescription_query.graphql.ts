/**
 * @generated SignedSource<<e613160778d73f7e009959973df1431c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ModelCostManifestSource = "BUNDLED" | "REMOTE";
import { FragmentRefs } from "relay-runtime";
export type useModelCostManifestDescription_query$data = {
  readonly modelCostManifest: {
    readonly generatedAt: string;
    readonly source: ModelCostManifestSource;
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "source",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "11395e8845de83dd74b1269f9a1c2480";

export default node;
