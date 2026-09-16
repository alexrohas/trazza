/* Las notas del journal se guardan en la misma columna de texto de siempre
   (journal_entries.notes), pero desde que hay un editor enriquecido (RichTextEditor.tsx)
   ese texto puede ser HTML de verdad (parrafos, negrita, listas...) o texto plano de una
   entrada creada antes de este cambio — no hay columna aparte que diga cual es cual.
   Estas funciones son el puente entre los dos mundos. */

/* Los unicos tags de bloque que el editor genera (ver RichTextEditor: solo parrafo,
   listas y sus items). Si el valor guardado empieza por uno de estos, es HTML de verdad
   y se pasa tal cual al editor / al render; si no, es texto plano y hay que escaparlo. */
const richTextBlockPrefix = /^\s*<(p|ul|ol)[\s>]/i;

export function isRichTextHtml(value: string): boolean {
  return richTextBlockPrefix.test(value);
}

/* Texto plano -> HTML seguro, conservando los saltos de linea (una linea en blanco separa
   parrafos, un salto suelto se queda como <br>). Sin esto, una nota antigua con varios
   parrafos se veia como uno solo al cargarla en el editor: el HTML colapsa los saltos de
   linea sueltos si no llevan una marca explicita. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plainTextToHtml(value: string): string {
  const paragraphs = value.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  if (paragraphs.length === 0) return "";
  return paragraphs.map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`).join("");
}

/* Punto de entrada unico: lo que haga falta para que value se pueda cargar en el editor
   (o pintar en modo lectura) sin perder saltos de linea ni reinterpretar por accidente un
   "<200" suelto como una etiqueta rota. */
export function notesToHtml(value: string | undefined): string {
  if (!value) return "";
  return isRichTextHtml(value) ? value : plainTextToHtml(value);
}

/* Para el buscador y la exportacion CSV, que quieren el texto tal cual lo leeria una
   persona, no el marcado. DOMParser con text/html no ejecuta nada (ni scripts ni
   recursos): es la forma segura de vaciar etiquetas en el navegador. */
export function stripHtmlToText(value: string | undefined): string {
  if (!value) return "";
  const html = notesToHtml(value);
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}
