import { act, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { SessionTokenCosts } from "@phoenix/components/trace/SessionTokenCosts";
import { ThemeProvider } from "@phoenix/contexts";

import { RichTooltip, TooltipTrigger, TriggerWrap } from "..";

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

function renderInClickableRow(trigger: ReactNode, onRowClick: () => void) {
  act(() => {
    root.render(
      <ThemeProvider>
        <table>
          <tbody>
            <tr onClick={onRowClick}>
              <td>{trigger}</td>
            </tr>
          </tbody>
        </table>
      </ThemeProvider>
    );
  });
}

describe("tooltip triggers inside a clickable row", () => {
  it("lets a click on TriggerWrap content reach the row", async () => {
    const onRowClick = vi.fn();
    renderInClickableRow(
      <TooltipTrigger>
        <TriggerWrap>
          <span>metadata preview</span>
        </TriggerWrap>
        <RichTooltip>details</RichTooltip>
      </TooltipTrigger>,
      onRowClick
    );
    await userEvent.setup().click(container.querySelector("span")!);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("lets a click on a session cost reach the row", async () => {
    const onRowClick = vi.fn();
    renderInClickableRow(
      <SessionTokenCosts totalCost={1.23} nodeId="session-1" />,
      onRowClick
    );
    await userEvent
      .setup()
      .click(container.querySelector<HTMLElement>("[role=button]")!);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
});
