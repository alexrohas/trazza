import type { EconomicEvent } from "../types";

/* CALENDARIO DE EVENTOS DE ALTO IMPACTO (la "carpeta roja" de Forex Factory).
   Solo citas que mueven los indices de EE. UU.; sin previsiones ni dato publicado, que es
   justo lo que cobran las APIs de calendario. Aqui solo se dice que ese dia hay evento y a
   que hora.

   De donde salen las fechas, todas de calendarios oficiales y publicos (nada de feeds de
   terceros, que son contenido suyo):
   - FOMC: calendario del Federal Reserve Board. La cita es el segundo dia de la reunion,
     que es cuando sale la decision (14:00 ET) y la rueda de prensa.
   - CPI, NFP: calendarios de publicaciones del BLS.
   - PCE: "Personal Income and Outlays" del BEA.
   - Ventas minoristas: "Advance Monthly Sales for Retail and Food Services" del Census.
   - ISM: primer dia habil (manufacturero) y tercero (servicios), a las 10:00 ET, que es lo
     que publica el propio ISM.

   Las horas se guardan como instante UTC y no como "14:30 hora de Madrid": el dato sale a
   una hora fija de Nueva York, y en las dos semanas al ano en que EE. UU. y Europa cambian
   la hora en fechas distintas esa misma cita cae una hora mas tarde aqui. Guardando el
   instante, la app solo tiene que pintarlo en la hora local de quien mira.

   HASTA CUANDO LLEGA: diciembre de 2026, mas las reuniones del FOMC de 2027 (la Fed publica
   las suyas con mas de un ano de antelacion). El resto de organismos publican su calendario
   anual en otono; cuando salga el de 2027 se anaden aqui y se despliega. La vista avisa sola
   cuando se queda sin eventos por delante, para que no parezca que no hay nada previsto. */
export const economicEvents: EconomicEvent[] = [
  { at: "2026-09-30T12:30:00Z", type: "pce" },
  { at: "2026-10-01T14:00:00Z", type: "ismManufacturing" },
  { at: "2026-10-02T12:30:00Z", type: "nfp" },
  { at: "2026-10-05T14:00:00Z", type: "ismServices" },
  { at: "2026-10-14T12:30:00Z", type: "cpi" },
  { at: "2026-10-15T12:30:00Z", type: "retailSales" },
  { at: "2026-10-28T18:00:00Z", type: "fomc" },
  { at: "2026-10-29T12:30:00Z", type: "pce" },
  { at: "2026-11-02T15:00:00Z", type: "ismManufacturing" },
  { at: "2026-11-04T15:00:00Z", type: "ismServices" },
  { at: "2026-11-06T13:30:00Z", type: "nfp" },
  { at: "2026-11-10T13:30:00Z", type: "cpi" },
  { at: "2026-11-17T13:30:00Z", type: "retailSales" },
  { at: "2026-11-25T13:30:00Z", type: "pce" },
  { at: "2026-12-01T15:00:00Z", type: "ismManufacturing" },
  { at: "2026-12-03T15:00:00Z", type: "ismServices" },
  { at: "2026-12-04T13:30:00Z", type: "nfp" },
  { at: "2026-12-09T19:00:00Z", type: "fomc" },
  { at: "2026-12-10T13:30:00Z", type: "cpi" },
  { at: "2026-12-16T13:30:00Z", type: "retailSales" },
  { at: "2026-12-23T13:30:00Z", type: "pce" },
  { at: "2027-01-27T19:00:00Z", type: "fomc" },
  { at: "2027-03-17T18:00:00Z", type: "fomc" },
  { at: "2027-04-28T18:00:00Z", type: "fomc" },
  { at: "2027-06-09T18:00:00Z", type: "fomc" },
  { at: "2027-07-28T18:00:00Z", type: "fomc" },
  { at: "2027-09-15T18:00:00Z", type: "fomc" },
  { at: "2027-10-27T18:00:00Z", type: "fomc" },
  { at: "2027-12-08T19:00:00Z", type: "fomc" },
];
