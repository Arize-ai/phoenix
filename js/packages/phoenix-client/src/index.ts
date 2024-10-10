import createOpenApiClient, { ClientOptions } from "openapi-fetch";
import type {
  paths as oapiPathsV1,
  components as oapiComponentsV1,
  operations as oapiOperationsV1,
} from "./__generated__/api/v1.d.ts";

type pathsV1 = oapiPathsV1;
type componentsV1 = oapiComponentsV1;
type operationsV1 = oapiOperationsV1;

export type Types = {
  V1: {
    paths: pathsV1;
    components: componentsV1;
    operations: operationsV1;
  };
};

export const createClient = (
  options: ClientOptions = { baseUrl: "http://localhost:6006" },
) => {
  return createOpenApiClient<pathsV1>(options);
};
