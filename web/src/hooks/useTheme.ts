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
    const root = document.documentElement;
    /* Desactiva todas las transiciones un instante mientras cambia el tema: sin esto,
       cualquier elemento con "transition" en una propiedad de color que dependa de un
       token (var(--positive-soft), etc.) puede quedarse atascado en el color del tema
       anterior indefinidamente, no solo animar lento. Es un bug conocido de Chrome con
       transiciones cuyo valor cambia por herencia de una custom property en un
       ancestro (aqui, :root[data-theme]) en vez de por un cambio de clase/regla en el
       propio elemento — el motor no siempre detecta que hay algo que transicionar.
       Confirmado con los dias del calendario del Journal (journal-day.positive/
       .negative): tras alternar el tema con el boton, el fondo se quedaba en el color
       del tema previo hasta recargar la pagina; cambiar el shorthand "background" por
       "background-color" en la transicion no lo arreglaba, asi que la causa no era el
       shorthand — hacia falta cortar la transicion en el momento exacto del cambio.
       setTimeout y no requestAnimationFrame: rAF no se dispara en una pestaña en
       segundo plano (el navegador la pausa), asi que si el usuario cambia de pestaña
       justo despues de tocar el boton, la limpieza no llegaria nunca y la app entera
       se quedaria sin transiciones hasta volver a esa pestaña. setTimeout si corre en
       background (con el throttling normal, que no afecta a un disparo unico y corto
       como este). */
    root.classList.add("theme-switching");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    safeLocalSet(storageKey, theme);
    void root.offsetHeight;
    const timeout = setTimeout(() => root.classList.remove("theme-switching"), 50);
    return () => clearTimeout(timeout);
  }, [theme]);

  return {
    setTheme,
    theme,
    toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
  };
}
