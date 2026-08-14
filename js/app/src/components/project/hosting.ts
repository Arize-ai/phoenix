import { BASE_URL } from "@phoenix/config";

export const HOSTED_PHOENIX_URL = "https://app.phoenix.arize.com";
export const LLAMATRACE_URL = "https://llamatrace.com";

export const HOSTED_BASE_URLS = [HOSTED_PHOENIX_URL, LLAMATRACE_URL];

export const IS_HOSTED_DEPLOYMENT = HOSTED_BASE_URLS.includes(BASE_URL);
