import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ProviderTheme } from "@arizeai/components";

export type ProviderThemeMode = ProviderTheme | "system";

export type ThemeContextType = {
  theme: ProviderTheme;
  themeMode: ProviderThemeMode;
  setThemeMode: (themeMode: ProviderThemeMode) => void;
};

export const LOCAL_STORAGE_THEME_KEY = "arize-phoenix-theme";
const DEFAULT_THEME = "dark";

export function getCurrentTheme(): ProviderTheme {
  const themeModeFromLocalStorage = localStorage.getItem(
    LOCAL_STORAGE_THEME_KEY
  );
  switch (themeModeFromLocalStorage) {
    case "light":
      return "light";
    case "dark":
      return "dark";
    case "system":
      return getSystemTheme();
    default:
      return DEFAULT_THEME;
  }
}

export function getCurrentThemeMode(): ProviderThemeMode {
  const themeModeFromLocalStorage = localStorage.getItem(
    LOCAL_STORAGE_THEME_KEY
  );
  switch (themeModeFromLocalStorage) {
    case "light":
      return "light";
    case "dark":
      return "dark";
    case "system":
      return "system";
    default:
      return DEFAULT_THEME;
  }
}

function getSystemTheme(): ProviderTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export function ThemeProvider(
  props: PropsWithChildren<{
    /**
     * If provided, the theme mode will become controlled and the theme will not update automatically.
     */
    themeMode?: ProviderThemeMode;
  }>
) {
  const [themeMode, _setThemeMode] = useState<ProviderThemeMode>(
    () => props.themeMode || getCurrentThemeMode()
  );
  const setThemeMode = useCallback((themeMode: ProviderThemeMode) => {
    localStorage.setItem(LOCAL_STORAGE_THEME_KEY, themeMode);
    _setThemeMode(themeMode);
  }, []);

  const theme = useMemo(() => {
    if (themeMode === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (props.themeMode) {
      _setThemeMode(props.themeMode);
    }
  }, [props.themeMode, setThemeMode]);

  useEffect(() => {
    // When the theme changes, set a class on the body to override the default theme
    document.body.classList.add(`ac-theme--${theme}`);
    return () => {
      document.body.classList.remove(`ac-theme--${theme}`);
    };
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode }}>
      {props.children}
    </ThemeContext.Provider>
  );
}
