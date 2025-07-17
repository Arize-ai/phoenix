import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { ProviderTheme } from "@arizeai/components";

export type ThemeContextType = {
  theme: ProviderTheme;
  setTheme: (theme: ProviderTheme) => void;
};

export const LOCAL_STORAGE_THEME_KEY = "arize-phoenix-theme";

export function getCurrentTheme(): ProviderTheme {
  const themeFromLocalStorage = localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
  return themeFromLocalStorage === "light" ? "light" : "dark";
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
     * If provided, the ThemeProvider will become controlled and the theme will not update automatically.
     */
    theme?: ProviderTheme;
  }>
) {
  const [theme, _setTheme] = useState<ProviderTheme>(
    () => props.theme || getCurrentTheme()
  );
  const setTheme = useCallback((theme: ProviderTheme) => {
    localStorage.setItem(LOCAL_STORAGE_THEME_KEY, theme);
    _setTheme(theme);
  }, []);

  useEffect(() => {
    if (props.theme) {
      _setTheme(props.theme);
    }
  }, [props.theme, setTheme]);

  useEffect(() => {
    // When the theme changes, set a class on the body to override the default theme
    document.body.classList.add(`ac-theme--${theme}`);
    return () => {
      document.body.classList.remove(`ac-theme--${theme}`);
    };
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {props.children}
    </ThemeContext.Provider>
  );
}
