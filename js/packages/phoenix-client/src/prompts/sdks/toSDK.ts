import invariant from "tiny-invariant";
import { toAI } from "./toAI";
import { toAnthropic } from "./toAnthropic";
import { toOpenAI } from "./toOpenAI";
import { toSDKParamsBase } from "./types";
import { assertUnreachable } from "../../utils/assertUnreachable";

const SUPPORTED_SDKS = ["openai", "anthropic", "ai"] as const;
type SupportedSDK = (typeof SUPPORTED_SDKS)[number];

// base params + toX params, inferred from the sdk by T
export type SDKParams<T extends SupportedSDK> = Parameters<
  (typeof PROVIDER_TO_SDK)[T]
>[0] extends toSDKParamsBase
  ? Parameters<(typeof PROVIDER_TO_SDK)[T]>[0]
  : never;

const PROVIDER_TO_SDK = {
  openai: toOpenAI,
  anthropic: toAnthropic,
  ai: toAI,
};

const getTargetSDK = <T extends SupportedSDK>(sdk: T) => {
  switch (sdk) {
    case "openai":
      return PROVIDER_TO_SDK.openai;
    case "anthropic":
      return PROVIDER_TO_SDK.anthropic;
    case "ai":
      return PROVIDER_TO_SDK.ai;
    default:
      assertUnreachable(sdk);
  }
};

type ToSDKParams<T extends SupportedSDK> = {
  sdk: T;
};

export const toSDK = <T extends SupportedSDK>({
  sdk: _sdk,
  ...rest
}: ToSDKParams<T> & SDKParams<T>) => {
  const sdk = getTargetSDK(_sdk);
  invariant(sdk, `No SDK found for provider ${_sdk}`);
  return sdk(rest) as ReturnType<(typeof PROVIDER_TO_SDK)[T]>;
};
