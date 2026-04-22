import type { SecretOwnerFilterOptions } from "@phoenix/constants";

export type SecretFormParams = {
  key: string;
  value: string;
};

export type SecretOwnerFilter = (typeof SecretOwnerFilterOptions)[number]["id"];
