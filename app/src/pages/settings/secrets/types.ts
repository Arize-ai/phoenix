import type { SecretOwnerFilterOptions } from "@phoenix/pages/settings/secrets/constants";

export type SecretFormParams = {
  key: string;
  value: string;
};

export type SecretOwnerFilter = (typeof SecretOwnerFilterOptions)[number]["id"];
