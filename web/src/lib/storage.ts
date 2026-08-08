/**
 * localStorage puede fallar por cuota llena o porque el navegador lo bloquea (modo
 * privado en Safari lanza en cualquier escritura). Nada de lo que guardamos ahi es
 * fuente de verdad -son preferencias y marcas locales-, asi que un fallo nunca debe
 * tumbar el flujo que lo llama.
 */
export function safeLocalSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`No se pudo guardar "${key}" en localStorage.`, error);
    return false;
  }
}

export function safeLocalGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`No se pudo leer "${key}" de localStorage.`, error);
    return null;
  }
}
