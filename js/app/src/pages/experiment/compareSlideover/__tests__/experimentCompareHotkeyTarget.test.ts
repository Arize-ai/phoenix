import type { MouseEvent } from "react";

import { isArrowKeyConsumer } from "../experimentCompareHotkeyTarget";
import {
  getCompareRowProps,
  isInteractiveClickTarget,
} from "../experimentCompareRowClickTarget";

function renderHTML(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  return container;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("isArrowKeyConsumer", () => {
  it.each([
    ["a text input", '<input id="target" type="text" />'],
    ["a textarea", '<textarea id="target"></textarea>'],
    [
      "an editable region",
      '<div contenteditable="true"><p id="target">x</p></div>',
    ],
    [
      "a radio inside a radio group",
      '<div role="radiogroup"><span id="target" role="radio"></span></div>',
    ],
    [
      "a menu item",
      '<div role="menu"><div id="target" role="menuitem"></div></div>',
    ],
    [
      "a resize handle",
      '<div id="target" role="separator" tabindex="0"></div>',
    ],
  ])("leaves arrow keys to %s", (_description, html) => {
    const container = renderHTML(html);
    expect(isArrowKeyConsumer(container.querySelector("#target"))).toBe(true);
  });

  it.each([
    ["a button", '<button id="target">Next</button>'],
    ["a scrollable section", '<section id="target" tabindex="-1"></section>'],
    [
      "a read-only code block",
      '<div contenteditable="false"><span id="target">{}</span></div>',
    ],
  ])("takes arrow keys from %s", (_description, html) => {
    const container = renderHTML(html);
    expect(isArrowKeyConsumer(container.querySelector("#target"))).toBe(false);
  });

  it("takes arrow keys when nothing is focused", () => {
    expect(isArrowKeyConsumer(null)).toBe(false);
  });
});

describe("isInteractiveClickTarget", () => {
  it("leaves a click on a control inside a row to the control", () => {
    const container = renderHTML(
      '<table><tr><td><button><svg id="target"></svg></button></td></tr></table>'
    );
    expect(isInteractiveClickTarget(container.querySelector("#target"))).toBe(
      true
    );
  });

  it("treats a click on a row's own content as a row click", () => {
    const container = renderHTML(
      '<table><tr><td><p id="target">output</p></td></tr></table>'
    );
    expect(isInteractiveClickTarget(container.querySelector("#target"))).toBe(
      false
    );
  });
});

describe("getCompareRowProps", () => {
  function clickRow({
    container,
    targetSelector,
  }: {
    container: HTMLElement;
    targetSelector: string;
  }) {
    const onRowClick = vi.fn();
    const { onClick } = getCompareRowProps({
      rowId: "row-1",
      selectedRowId: null,
      onRowClick,
    });
    onClick({
      target: container.querySelector(targetSelector),
      currentTarget: container.querySelector("tr"),
    } as unknown as MouseEvent<HTMLTableRowElement>);
    return onRowClick;
  }

  it("opens the row when its own content is clicked", () => {
    const container = renderHTML(
      '<table><tr><td><p id="target">output</p></td></tr></table>'
    );
    expect(
      clickRow({ container, targetSelector: "#target" })
    ).toHaveBeenCalledWith("row-1");
  });

  it("ignores a click that reaches the row from an overlay outside it", () => {
    const container = renderHTML(
      '<table><tr><td>output</td></tr></table><div id="popover"><p id="target">filter</p></div>'
    );
    expect(
      clickRow({ container, targetSelector: "#target" })
    ).not.toHaveBeenCalled();
  });

  it("ignores the click that ends a text selection in the row", () => {
    const container = renderHTML(
      '<table><tr><td><p id="target">output</p></td></tr></table>'
    );
    window.getSelection()?.selectAllChildren(container);
    expect(
      clickRow({ container, targetSelector: "#target" })
    ).not.toHaveBeenCalled();
    window.getSelection()?.removeAllRanges();
  });

  it("ignores a click on a list option inside the row", () => {
    const container = renderHTML(
      '<table><tr><td><div id="target" role="option">label</div></td></tr></table>'
    );
    expect(
      clickRow({ container, targetSelector: "#target" })
    ).not.toHaveBeenCalled();
  });
});
