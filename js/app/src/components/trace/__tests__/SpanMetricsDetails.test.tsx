import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  graphql,
  RelayEnvironmentProvider,
  useLazyLoadQuery,
} from "react-relay";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { SpanMetricsDetails } from "../SpanMetricsDetails";
import type { SpanMetricsDetailsTestQuery } from "./__generated__/SpanMetricsDetailsTestQuery.graphql";

/**
 * Spreads the fragment under test into a test-only query. With
 * `@relay_test_operation`, MockPayloadGenerator knows each field's schema
 * type, so Int, Float and Boolean fields get typed mock values.
 */
function SpanMetricsDetailsTestRenderer() {
  const data = useLazyLoadQuery<SpanMetricsDetailsTestQuery>(
    graphql`
      query SpanMetricsDetailsTestQuery @relay_test_operation {
        span: node(id: "test-span-id") {
          ... on Span {
            ...SpanMetricsDetails_span
          }
        }
      }
    `,
    {}
  );
  return <SpanMetricsDetails span={data.span} />;
}

installTestMatchMedia();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderWithSpan(
  mockResolvers: MockPayloadGenerator.MockResolvers
) {
  const environment = createMockEnvironment();
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <ThemeProvider themeMode="dark">
          <Suspense fallback="loading">
            <SpanMetricsDetailsTestRenderer />
          </Suspense>
        </ThemeProvider>
      </RelayEnvironmentProvider>
    );
  });
  await act(async () => {
    environment.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation, {
        Node: () => ({ __typename: "Span" }),
        ...mockResolvers,
      })
    );
  });
}

describe("SpanMetricsDetails", () => {
  it("shows the span's token counts and cost", async () => {
    await renderWithSpan({
      Span: () => ({
        tokenCountTotal: 1500,
        tokenCountPrompt: 1000,
        tokenCountCompletion: 500,
        costSummary: {
          total: { cost: 0.25 },
          prompt: { cost: 0.2 },
          completion: { cost: 0.05 },
        },
        costDetailSummaryEntries: [],
      }),
    });

    expect(container.textContent).toContain("Tokens and cost");
    expect(container.textContent).toContain("1,500");
    expect(container.textContent).toContain("$0.2500");
  });

  it("drops the cost when the span was not priced", async () => {
    await renderWithSpan({
      Span: () => ({
        tokenCountTotal: 1500,
        tokenCountPrompt: 1000,
        tokenCountCompletion: 500,
        costDetailSummaryEntries: [],
      }),
      CostBreakdown: () => ({ cost: null }),
    });

    expect(container.textContent).toContain("Tokens");
    expect(container.textContent).not.toContain("Cost");
  });
});
