import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { THEME_STORAGE_KEY } from "@phoenix/constants/storageConstants";

import type { ProviderThemeMode } from "../ThemeContext";
import {
  getCurrentTheme,
  getCurrentThemeMode,
  isProviderThemeMode,
  ThemeProvider,
  useTheme,
} from "../ThemeContext";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // jsdom has no matchMedia; ThemeProvider reads it for the system theme.
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  localStorage.removeItem(THEME_STORAGE_KEY);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  localStorage.removeItem(THEME_STORAGE_KEY);
  vi.unstubAllGlobals();
});

function ThemeProbe() {
  const { theme, themeMode, setThemeMode } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="theme-mode">{themeMode}</span>
      {(["light", "dark", "sunshine"] as ProviderThemeMode[]).map((mode) => (
        <button key={mode} type="button" onClick={() => setThemeMode(mode)}>
          {mode}
        </button>
      ))}
    </div>
  );
}

function textOf(testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`)?.textContent;
}

function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent === label
  );
  if (!button) {
    throw new Error(`No button labelled ${label}`);
  }
  act(() => {
    button.click();
  });
}

describe("ThemeContext sunshine mode", () => {
  it("accepts sunshine as a theme mode", () => {
    expect(isProviderThemeMode("sunshine")).toBe(true);
    expect(isProviderThemeMode("yellow")).toBe(false);
  });

  it("resolves a stored sunshine mode to the light base theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sunshine");
    expect(getCurrentThemeMode()).toBe("sunshine");
    expect(getCurrentTheme()).toBe("light");
  });

  it("applies the light and sunshine theme classes to the body", () => {
    act(() => {
      root.render(
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>
      );
    });

    clickButton("sunshine");

    expect(textOf("theme")).toBe("light");
    expect(textOf("theme-mode")).toBe("sunshine");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("sunshine");
    expect(document.body.classList.contains("theme")).toBe(true);
    expect(document.body.classList.contains("theme--light")).toBe(true);
    expect(document.body.classList.contains("theme--sunshine")).toBe(true);

    clickButton("light");

    expect(textOf("theme")).toBe("light");
    expect(document.body.classList.contains("theme--light")).toBe(true);
    expect(document.body.classList.contains("theme--sunshine")).toBe(false);

    clickButton("sunshine");
    clickButton("dark");

    expect(textOf("theme")).toBe("dark");
    expect(document.body.classList.contains("theme--dark")).toBe(true);
    expect(document.body.classList.contains("theme--light")).toBe(false);
    expect(document.body.classList.contains("theme--sunshine")).toBe(false);
  });
});
