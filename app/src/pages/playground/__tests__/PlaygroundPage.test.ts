import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { _resetInstanceId, _resetMessageId } from "@phoenix/store";

import {
  buildPlaygroundInstancesFromLoaderData,
  buildPlaygroundPropsFromLoaderData,
} from "../playgroundPageLoader";

beforeEach(() => {
  _resetInstanceId();
  _resetMessageId();
});

describe("buildPlaygroundInstancesFromLoaderData", () => {
  it("returns undefined when loader data is null", () => {
    expect(buildPlaygroundInstancesFromLoaderData(null)).toBeUndefined();
  });

  it("returns undefined when instances array is empty", () => {
    expect(
      buildPlaygroundInstancesFromLoaderData({
        promptParams: [],
        instances: [],
        templateFormat: TemplateFormats.Mustache,
      })
    ).toBeUndefined();
  });
});

describe("buildPlaygroundPropsFromLoaderData", () => {
  it("returns an empty object when loader data is null", () => {
    const result = buildPlaygroundPropsFromLoaderData(null);
    expect(result).toEqual({});
  });

  it("returns an empty object when instances array is empty", () => {
    const result = buildPlaygroundPropsFromLoaderData({
      promptParams: [],
      instances: [],
      templateFormat: TemplateFormats.Mustache,
    });
    expect(result).toEqual({});
  });

  it("does NOT include templateFormat or instances when loader data is null", () => {
    const result = buildPlaygroundPropsFromLoaderData(null);
    expect(result).not.toHaveProperty("templateFormat");
    expect(result).not.toHaveProperty("instances");
  });
});
