import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useT } from "../lib/i18n/context";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  icon?: ReactNode;
};

/**
 * El campo de contraseña de las pantallas de acceso, con el botón de mostrarla dentro.
 *
 * Al enviar el formulario se vuelve a ocultar, y a mano sobre el DOM además de con el
 * estado: React repinta después del envío, y con el campo aún en `text` el navegador
 * puede guardar la contraseña en el historial de los campos de texto normales, que luego
 * ofrece como sugerencia en cualquier otro formulario.
 */
export function PasswordField({ icon, ...inputProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form) return;
    const hide = () => {
      input.type = "password";
      setVisible(false);
    };
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  return (
    <div className="auth-field">
      {icon}
      <input {...inputProps} ref={inputRef} type={visible ? "text" : "password"} />
      {/* Va después del campo a propósito: el <label> que lo envuelve pasa sus clics al
          primer control que contiene, y ese tiene que ser el campo, no este botón. */}
      <button
        aria-label={visible ? t("auth.field.hidePasswordLabel") : t("auth.field.showPasswordLabel")}
        className="auth-field-toggle"
        onClick={() => setVisible((current) => !current)}
        /* Sin esto el clic le quita el foco al campo y hay que volver a pinchar en él para
           seguir escribiendo. Con el teclado se llega igual, con Tab. */
        onMouseDown={(event) => event.preventDefault()}
        type="button"
      >
        {visible ? t("auth.field.hidePassword") : t("auth.field.showPassword")}
      </button>
    </div>
  );
}
