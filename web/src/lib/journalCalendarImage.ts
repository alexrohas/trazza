import type { useT } from "./i18n/context";
import { formatMoney, formatMoneyCompactSigned, formatPercentCompact, signedTone } from "./metrics";
import type { Currency } from "../types";

/* Genera un PNG del calendario del Journal para compartir: lo dibuja a mano en un
   <canvas> a partir de los mismos datos que pinta el panel (semanas, total del mes),
   no es una captura del DOM. Ventajas de hacerlo asi: cero dependencias nuevas (mismo
   patron que compressOperationImage), salida de tamano fijo y @2x nitida
   independiente del zoom o del ancho de pantalla, y no arrastra la rejilla que en
   movil se recorta (CLAUDE.md). El precio es que este dibujo hay que mantenerlo a
   juego si cambia el diseno visual del calendario. */

export type CalendarImageDay = {
  count: number;
  date: string; // YYYY-MM-DD
  inMonth: boolean;
  payoutCount: number;
  payoutGross: number;
  pnl: number;
  wins: number; // operaciones ganadoras del dia, para el winrate de la celda
};

export type CalendarImageWeek = {
  days: CalendarImageDay[];
  entries: number;
  key: string;
  pnl: number;
  tradedDays: number;
};

export type CalendarImageInput = {
  currency: Currency;
  monthKey: string; // YYYY-MM, solo para el nombre del archivo
  monthLabel: string; // "septiembre de 2026"
  monthTotal: number;
  todayDate: string; // YYYY-MM-DD
  weekdayLabels: string[]; // 7, Lun..Dom
  weeks: CalendarImageWeek[];
};

type ShareCapableNavigator = Navigator & {
  canShare?: (data?: ShareData) => boolean;
  share?: (data?: ShareData) => Promise<void>;
};

const SCALE = 2;
const W = 1120;
const PAD = 52;
const CARD_INSET = 16;
const COL_GAP = 10;
const ROW_GAP = 10;
const HEADER_H = 74;
const GAP_HEADER_GRID = 22;
const WEEKDAY_H = 32;
const GAP_WEEKDAY_ROW = 10;
const CELL_H = 104;
const GAP_GRID_FOOTER = 20;
const FOOTER_H = 40;

const CONTENT_W = W - PAD * 2;
const WEEK_W = 150;
const DAY_W = Math.floor((CONTENT_W - WEEK_W - COL_GAP * 7) / 7);

const FONT_STACK = '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

function readTokens() {
  const s = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  const dark = document.documentElement.dataset.theme === "dark";
  return {
    bg: pick("--bg", dark ? "#0f0f12" : "#f6f6f7"),
    surface: pick("--surface", dark ? "#141418" : "#ffffff"),
    surfaceMuted: pick("--surface-muted", dark ? "#1b1b20" : "#f2f2f4"),
    text: pick("--text", dark ? "#f7f7fb" : "#08090b"),
    muted: pick("--muted", dark ? "#9ca3af" : "#71717a"),
    strongMuted: pick("--strong-muted", dark ? "#d4d4dc" : "#3f3f46"),
    line: pick("--line", dark ? "#27272f" : "#e4e4e7"),
    lineStrong: pick("--line-strong", dark ? "#363641" : "#d4d4d8"),
    positive: pick("--positive", dark ? "#1ed982" : "#16c76f"),
    positiveSoft: pick("--positive-soft", dark ? "rgba(30, 217, 130, 0.13)" : "#e8f8ef"),
    negative: pick("--negative", dark ? "#ff6b73" : "#ff5f64"),
    negativeSoft: pick("--negative-soft", dark ? "rgba(255, 107, 115, 0.13)" : "#fdecec"),
    accent: pick("--accent", dark ? "#a779ff" : "#8b5cf6"),
    // El calendario tine los dias de payout de azul, no de rojo (styles.css
    // .journal-day.payout); se replica aqui a mano porque no es un token.
    payoutSoft: dark ? "rgba(56, 189, 248, 0.12)" : "rgba(56, 189, 248, 0.14)",
    payoutText: dark ? "#7dd3fc" : "#0284c7",
  };
}

type Tokens = ReturnType<typeof readTokens>;

function toneColor(value: number, c: Tokens) {
  const tone = signedTone(value);
  if (tone === "positive") return c.positive;
  if (tone === "negative") return c.negative;
  return c.strongMuted;
}

function toneSoft(value: number, c: Tokens) {
  const tone = signedTone(value);
  if (tone === "positive") return c.positiveSoft;
  if (tone === "negative") return c.negativeSoft;
  return null;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

async function waitForFonts() {
  try {
    const set = document.fonts;
    if (!set) return;
    await Promise.all([
      set.load(`700 30px ${FONT_STACK}`),
      set.load(`600 16px ${FONT_STACK}`),
      set.load(`500 12px ${FONT_STACK}`),
    ]);
    await set.ready;
  } catch {
    /* Sin la fuente exacta el navegador cae en system-ui: la imagen sale bien igual. */
  }
}

function trimTrailingEmptyWeeks(weeks: CalendarImageWeek[]) {
  let count = weeks.length;
  while (count > 1 && weeks[count - 1].days.every((day) => !day.inMonth)) count -= 1;
  return weeks.slice(0, count);
}

function drawCalendar(canvas: HTMLCanvasElement, input: CalendarImageInput, t: ReturnType<typeof useT>) {
  const c = readTokens();
  const weeks = trimTrailingEmptyWeeks(input.weeks);
  const rows = Math.max(1, weeks.length);

  const gridTop = PAD + HEADER_H + GAP_HEADER_GRID + WEEKDAY_H + GAP_WEEKDAY_ROW;
  const gridBottom = gridTop + rows * CELL_H + (rows - 1) * ROW_GAP;
  const height = gridBottom + GAP_GRID_FOOTER + FOOTER_H + PAD;

  canvas.width = W * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";

  const label = (text: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left", baseline: CanvasTextBaseline = "alphabetic") => {
    ctx.font = `${font} ${FONT_STACK}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(text, x, y);
  };

  // Fondo + tarjeta, para que la imagen se lea como el panel y no como un recorte suelto.
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, height);
  roundRectPath(ctx, CARD_INSET, CARD_INSET, W - CARD_INSET * 2, height - CARD_INSET * 2, 18);
  ctx.fillStyle = c.surface;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = c.line;
  ctx.stroke();

  // Cabecera: mes a la izquierda, total del mes a la derecha (mismo bloque que el panel).
  label(capitalize(input.monthLabel), PAD, PAD + 30, "700 30px", c.text, "left", "alphabetic");
  label(t("journal.calendar.monthTotal").toUpperCase(), W - PAD, PAD + 12, "600 11px", c.muted, "right", "alphabetic");
  label(formatMoney(input.monthTotal, input.currency), W - PAD, PAD + 44, "700 25px", toneColor(input.monthTotal, c), "right", "alphabetic");

  // Cabeceras de dia.
  const weekdayY = PAD + HEADER_H + GAP_HEADER_GRID + WEEKDAY_H / 2;
  for (let i = 0; i < 7; i += 1) {
    const x = PAD + i * (DAY_W + COL_GAP) + DAY_W / 2;
    label((input.weekdayLabels[i] || "").toUpperCase(), x, weekdayY, "700 11px", c.muted, "center", "middle");
  }
  const weekColX = PAD + 7 * (DAY_W + COL_GAP);
  label(t("journal.calendar.weekColumn").toUpperCase(), weekColX + WEEK_W / 2, weekdayY, "700 11px", c.accent, "center", "middle");

  // Rejilla.
  for (let wi = 0; wi < rows; wi += 1) {
    const week = weeks[wi];
    const rowY = gridTop + wi * (CELL_H + ROW_GAP);

    for (let di = 0; di < 7; di += 1) {
      const day = week.days[di];
      if (!day) continue;
      const x = PAD + di * (DAY_W + COL_GAP);
      const hasTrades = day.count > 0;
      const hasPayout = day.payoutCount > 0;
      const active = day.inMonth && (hasTrades || hasPayout);

      roundRectPath(ctx, x, rowY, DAY_W, CELL_H, 8);
      ctx.fillStyle = day.inMonth ? c.surface : c.bg;
      ctx.fill();
      if (active) {
        const tint = hasTrades ? toneSoft(day.pnl, c) : c.payoutSoft;
        if (tint) {
          ctx.fillStyle = tint;
          ctx.fill();
        }
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = active ? c.lineStrong : c.line;
      ctx.stroke();

      if (!day.inMonth) ctx.globalAlpha = 0.52;

      // El numero del dia en la esquina superior derecha, como en la UI (y Tradezella).
      const dayNumber = String(Number(day.date.slice(-2)));
      if (day.date === input.todayDate) {
        ctx.beginPath();
        ctx.arc(x + DAY_W - 18, rowY + 18, 12, 0, Math.PI * 2);
        ctx.fillStyle = c.accent;
        ctx.fill();
        label(dayNumber, x + DAY_W - 18, rowY + 18, "700 12px", "#ffffff", "center", "middle");
      } else {
        label(dayNumber, x + DAY_W - 12, rowY + 14, "700 12px", c.muted, "right", "middle");
      }

      // Importe (grande) + operaciones + winrate, centrados como grupo. Un dia vacio no
      // pinta nada mas: en la UI la celda se apaga, aqui igual (sin el "–" de antes).
      if (hasTrades || hasPayout) {
        // Mismo criterio que la celda de la UI: un dia de solo payout ensena lo cobrado, en
        // azul y sin signo. Antes iba con "-" y en la imagen compartida parecia una perdida.
        const amountText = hasTrades
          ? formatMoneyCompactSigned(day.pnl, input.currency)
          : formatMoneyCompactSigned(day.payoutGross, input.currency, "never");
        const amountColor = hasTrades ? toneColor(day.pnl, c) : c.payoutText;
        label(amountText, x + DAY_W / 2, rowY + CELL_H / 2 - 6, "700 18px", amountColor, "center", "middle");

        if (day.inMonth) {
          const sub = hasTrades
            ? `${day.count} ${day.count === 1 ? t("journal.calendar.opsSuffixOne") : t("journal.calendar.opsSuffix")}`
            : t("journal.calendar.payoutPrefix");
          label(sub, x + DAY_W / 2, rowY + CELL_H / 2 + 14, "600 11px", c.muted, "center", "middle");
          if (hasTrades) {
            label(formatPercentCompact(day.wins / day.count), x + DAY_W / 2, rowY + CELL_H / 2 + 30, "600 11px", c.muted, "center", "middle");
          }
        }
      }

      ctx.globalAlpha = 1;
    }

    // Resumen semanal (octava columna).
    roundRectPath(ctx, weekColX, rowY, WEEK_W, CELL_H, 8);
    const weekTint = week.entries ? toneSoft(week.pnl, c) : null;
    ctx.fillStyle = weekTint || c.bg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = c.line;
    ctx.stroke();

    label(`${t("journal.calendar.weekPrefix")} ${wi + 1}`, weekColX + 14, rowY + 18, "700 10px", c.accent, "left", "middle");
    label(
      formatMoneyCompactSigned(week.entries ? week.pnl : 0, input.currency),
      weekColX + 14,
      rowY + CELL_H / 2 + 4,
      "700 15px",
      week.entries ? toneColor(week.pnl, c) : c.muted,
      "left",
      "middle",
    );
    const pillText = `${week.tradedDays} ${week.tradedDays === 1 ? t("journal.calendar.daysUnitOne") : t("journal.calendar.daysUnit")}`;
    ctx.font = `700 11px ${FONT_STACK}`;
    const pillW = ctx.measureText(pillText).width + 16;
    const pillH = 18;
    const pillX = weekColX + WEEK_W - 14 - pillW;
    const pillY = rowY + CELL_H - 14 - pillH;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, 9);
    ctx.fillStyle = c.surfaceMuted;
    ctx.fill();
    label(pillText, pillX + pillW / 2, pillY + pillH / 2, "700 11px", c.strongMuted, "center", "middle");
  }

  // Pie: marca de la app + fecha de generacion.
  const footerY = gridBottom + GAP_GRID_FOOTER + FOOTER_H / 2;
  ctx.beginPath();
  ctx.moveTo(PAD, gridBottom + GAP_GRID_FOOTER);
  ctx.lineTo(W - PAD, gridBottom + GAP_GRID_FOOTER);
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  label("trazzajournal.com", PAD, footerY, "700 14px", c.accent, "left", "middle");
  const generated = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  label(generated, W - PAD, footerY, "500 12px", c.muted, "right", "middle");
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))), "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

/* Dibuja el calendario y lo entrega: hoja de compartir nativa cuando el navegador la
   soporta con archivos (movil sobre todo), y descarga directa del PNG en el resto.
   Devuelve "shared" | "downloaded" | "cancelled" por si el llamador quiere avisar. */
export async function shareJournalCalendarImage(
  input: CalendarImageInput,
  t: ReturnType<typeof useT>,
): Promise<"shared" | "downloaded" | "cancelled"> {
  await waitForFonts();

  const canvas = document.createElement("canvas");
  drawCalendar(canvas, input, t);
  const blob = await canvasToBlob(canvas);
  const filename = `trazza-calendario-${input.monthKey}.png`;

  const nav = navigator as ShareCapableNavigator;
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: t("journal.calendar.shareImage"),
        text: `${capitalize(input.monthLabel)} · Trazza`,
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Cualquier otro fallo del share: se cae a la descarga.
    }
  }

  downloadBlob(blob, filename);
  return "downloaded";
}
