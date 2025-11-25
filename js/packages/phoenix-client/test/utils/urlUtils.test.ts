import {
  getDatasetExperimentsUrl,
  getDatasetUrl,
  getExperimentUrl,
} from "../../src/utils/urlUtils";

import { describe, expect, it } from "vitest";

describe("urlUtils", () => {
  it("should append trailing slash when baseUrl has no trailing slash", () => {
    const baseUrl = "https://app.phoenix.arize.com/s/space-id";
    const datasetId = "dataset-123";
    const url = getDatasetUrl({ baseUrl, datasetId });

    expect(url).toBe(
      "https://app.phoenix.arize.com/s/space-id/datasets/dataset-123/examples"
    );
    expect(url).toContain("/datasets/");
  });

  it("should handle baseUrl with trailing slash correctly", () => {
    const baseUrl = "https://app.phoenix.arize.com/s/space-id/";
    const datasetId = "dataset-123";
    const url = getDatasetUrl({ baseUrl, datasetId });

    expect(url).toBe(
      "https://app.phoenix.arize.com/s/space-id/datasets/dataset-123/examples"
    );
    expect(url).toContain("/datasets/");
  });

  it("should handle standard Phoenix URL without trailing slash", () => {
    const baseUrl = "http://localhost:6006";
    const datasetId = "dataset-123";
    const url = getDatasetUrl({ baseUrl, datasetId });

    expect(url).toBe("http://localhost:6006/datasets/dataset-123/examples");
  });

  it("should handle standard Phoenix URL with trailing slash", () => {
    const baseUrl = "http://localhost:6006/";
    const datasetId = "dataset-123";
    const url = getDatasetUrl({ baseUrl, datasetId });

    expect(url).toBe("http://localhost:6006/datasets/dataset-123/examples");
  });

  it("should construct correct dataset URL", () => {
    const baseUrl = "https://app.phoenix.arize.com/s/space-id";
    const datasetId = "dataset-123";
    const url = getDatasetUrl({ baseUrl, datasetId });

    expect(url).toBe(
      "https://app.phoenix.arize.com/s/space-id/datasets/dataset-123/examples"
    );
  });

  it("should construct correct dataset experiments URL without trailing slash", () => {
    const baseUrl = "https://app.phoenix.arize.com/s/space-id";
    const datasetId = "dataset-123";
    const url = getDatasetExperimentsUrl({ baseUrl, datasetId });

    expect(url).toBe(
      "https://app.phoenix.arize.com/s/space-id/datasets/dataset-123/experiments"
    );
  });

  it("should construct correct dataset experiments URL with trailing slash", () => {
    const baseUrl = "https://app.phoenix.arize.com/s/space-id/";
    const datasetId = "dataset-123";
    const url = getDatasetExperimentsUrl({ baseUrl, datasetId });

    expect(url).toBe(
      "https://app.phoenix.arize.com/s/space-id/datasets/dataset-123/experiments"
    );
  });

  it("should construct correct experiment URL without trailing slash", () => {
    const baseUrl = "https://app.phoenix.arize.com/s/space-id";
    const datasetId = "dataset-123";
    const experimentId = "experiment-456";
    const url = getExperimentUrl({ baseUrl, datasetId, experimentId });

    expect(url).toBe(
      "https://app.phoenix.arize.com/s/space-id/datasets/dataset-123/compare?experimentId=experiment-456"
    );
  });

  it("should construct correct experiment URL with trailing slash", () => {
    const baseUrl = "https://app.phoenix.arize.com/s/space-id/";
    const datasetId = "dataset-123";
    const experimentId = "experiment-456";
    const url = getExperimentUrl({ baseUrl, datasetId, experimentId });

    expect(url).toBe(
      "https://app.phoenix.arize.com/s/space-id/datasets/dataset-123/compare?experimentId=experiment-456"
    );
  });

  it("should properly encode experiment ID in query parameter", () => {
    const baseUrl = "https://app.phoenix.arize.com/s/space-id";
    const datasetId = "dataset-123";
    const experimentId = "exp/with/slashes";
    const url = getExperimentUrl({ baseUrl, datasetId, experimentId });

    expect(url).toContain("experimentId=exp%2Fwith%2Fslashes");
  });

  it("should handle localhost URLs", () => {
    const baseUrl = "http://localhost:6006";
    const datasetId = "dataset-123";
    const url = getDatasetUrl({ baseUrl, datasetId });

    expect(url).toBe("http://localhost:6006/datasets/dataset-123/examples");
  });

  it("should handle URLs with ports", () => {
    const baseUrl = "https://app.phoenix.arize.com:8080/s/space-id";
    const datasetId = "dataset-123";
    const url = getDatasetUrl({ baseUrl, datasetId });

    expect(url).toBe(
      "https://app.phoenix.arize.com:8080/s/space-id/datasets/dataset-123/examples"
    );
  });

  it("should handle deep paths in baseUrl", () => {
    const baseUrl = "https://custom.domain.com/s/space-id/nested/again";
    const datasetId = "dataset-123";
    const url = getDatasetUrl({ baseUrl, datasetId });

    expect(url).toBe(
      "https://custom.domain.com/s/space-id/nested/again/datasets/dataset-123/examples"
    );
  });
});
