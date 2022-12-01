import { Provider } from "@arizeai/components";
import React, { ReactNode } from "react";
import ReactDom from "react-dom/client";
import { NotebookLayout } from "./components/layout";
import { UMAPWidget, UMAPWidgetProps } from "./components/widgets";

declare global {
    interface Window {
        renderUMAPWidget: (data: UMAPWidgetProps) => void;
    }
}

const WidgetWrapper = ({ children }: { children: ReactNode }) => (
    <Provider>
        <NotebookLayout>{children}</NotebookLayout>
    </Provider>
);

/**
 * Global export of rendering widgets for use in notebooks
 */
window.renderUMAPWidget = function (data: UMAPWidgetProps) {
    const rootEl = document.getElementById("root");
    const root = ReactDom.createRoot(rootEl!);
    root.render(
        <WidgetWrapper>
            <UMAPWidget {...data} />
        </WidgetWrapper>
    );
};
