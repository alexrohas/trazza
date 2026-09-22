/**
 * Lector de CSV minimo y sin dependencias: comillas dobles, comillas escapadas ("") y
 * saltos de linea dentro de un campo entrecomillado. Lo comparten la importacion de
 * Tradovate y la de extractos del banco. Descarta las filas vacias.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = String(text || "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (char === "\r" && next === "\n") index += 1;
    } else {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows.filter((item) => item.some((cell) => String(cell || "").trim()));
}
