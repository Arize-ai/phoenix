import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useState,
} from "react";

import { ProviderTheme } from "@arizeai/components";

export type ThemeContextType = {
  theme: ProviderTheme;
  setTheme: (theme: ProviderTheme) => void;
};

const localStorageTheme =
  localStorage.getItem("theme") == "light" ? "light" : "dark";

export const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export function ThemeProvider(props: PropsWithChildren) {
  const [theme, _setTheme] = useState<ProviderTheme>(localStorageTheme);
  const setTheme = useCallback((theme: ProviderTheme) => {
    localStorage.setItem("theme", theme);
    _setTheme(theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {props.children}
    </ThemeContext.Provider>
  );
}
