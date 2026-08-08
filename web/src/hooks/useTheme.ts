import { useEffect, useState } from "react";
import { safeLocalGet, safeLocalSet } from "../lib/storage";

type Theme = "light" | "dark";

const storageKey = "trazza:theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = safeLocalGet(storageKey);
    return stored === "dark" || stored === "light" ? stored : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    safeLocalSet(storageKey, theme);
  }, [theme]);

  return {
    setTheme,
    theme,
    toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
  };
}
