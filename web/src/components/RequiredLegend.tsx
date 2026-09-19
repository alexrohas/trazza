import { useT } from "../lib/i18n/context";

/**
 * "* Obligatorio. El resto es opcional." Va dentro de la fila de acciones de los
 * formularios largos, pegada a la izquierda.
 *
 * Es un componente y no seis copias del mismo <span> para que el texto viva en un solo
 * sitio: si algun dia cambia la marca (o se decide marcar lo opcional en vez de lo
 * obligatorio), se cambia aqui y no formulario por formulario.
 */
export function RequiredLegend() {
  const t = useT();
  return (
    <p className="form-required-note">
      <em>*</em> {t("common.requiredLegend")}
    </p>
  );
}
