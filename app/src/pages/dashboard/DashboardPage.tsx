// @ts-expect-error: no types for react-grid-layout
import { Layouts, Responsive, WidthProvider } from "react-grid-layout";
import { css } from "@emotion/react";

const ResponsiveGridLayout = WidthProvider(Responsive);

const layouts: Layouts = {
  lg: [
    { i: "a", x: 0, y: 0, w: 4, h: 2 },
    { i: "b", x: 4, y: 0, w: 4, h: 2 },
    { i: "c", x: 8, y: 0, w: 4, h: 2 },
  ],
};

const gridItemCSS = css`
  background: var(--ac-global-color-grey-100);
  border: 1px solid var(--ac-global-border-color-default);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  height: 100%;
`;

export function DashboardPage() {
  return (
    <div
      css={css`
        width: 100%;
        height: 100%;
        padding: 32px;
        box-sizing: border-box;
        background: var(--ac-global-color-grey-50);
      `}
    >
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={80}
        isResizable
        isDraggable
        style={{ minHeight: 400 }}
      >
        <div key="a" css={gridItemCSS}>
          Grid Item A
        </div>
        <div key="b" css={gridItemCSS}>
          Grid Item B
        </div>
        <div key="c" css={gridItemCSS}>
          Grid Item C
        </div>
      </ResponsiveGridLayout>
    </div>
  );
}
