import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  PreferencesProvider,
  usePreferencesContext,
} from "../PreferencesContext";

const PREFERENCES_STORAGE_KEY = "arize-phoenix-preferences";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  document.documentElement.removeAttribute("data-native-scrollbars");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  document.documentElement.removeAttribute("data-native-scrollbars");
});

function NativeScrollbarPreferenceControl() {
  const isNativeScrollbarStylingEnabled = usePreferencesContext(
    (state) => state.isNativeScrollbarStylingEnabled
  );
  const setIsNativeScrollbarStylingEnabled = usePreferencesContext(
    (state) => state.setIsNativeScrollbarStylingEnabled
  );

  return (
    <button
      onClick={() =>
        setIsNativeScrollbarStylingEnabled(!isNativeScrollbarStylingEnabled)
      }
    >
      {String(isNativeScrollbarStylingEnabled)}
    </button>
  );
}

describe("PreferencesProvider", () => {
  it("uses minimal scrollbar styling by default", () => {
    act(() => {
      root.render(
        <PreferencesProvider>
          <NativeScrollbarPreferenceControl />
        </PreferencesProvider>
      );
    });

    expect(
      document.documentElement.hasAttribute("data-native-scrollbars")
    ).toBe(false);
  });

  it("applies and persists native scrollbar styling", () => {
    act(() => {
      root.render(
        <PreferencesProvider>
          <NativeScrollbarPreferenceControl />
        </PreferencesProvider>
      );
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      document.documentElement.hasAttribute("data-native-scrollbars")
    ).toBe(true);
    const persistedPreferences = JSON.parse(
      localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "{}"
    );
    expect(persistedPreferences.state?.isNativeScrollbarStylingEnabled).toBe(
      true
    );
  });
});
