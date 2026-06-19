import { useState } from "react";
import { LockKeyhole, Mail, Moon, Sun, UserRound } from "lucide-react";

type AuthScreenProps = {
  busy: boolean;
  message?: {
    type: "info" | "success" | "error";
    text: string;
  } | null;
  theme: "dark" | "light";
  onSignIn: (credentials: { email: string; password: string }) => Promise<void>;
  onSignUp: (credentials: { fullName: string; email: string; password: string }) => Promise<void>;
  onThemeToggle: () => void;
};

export function AuthScreen({ busy, message, onSignIn, onSignUp, onThemeToggle, theme }: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isSignup = mode === "signup";

  return (
    <main className="auth-screen">
      <button className="auth-theme-toggle" onClick={onThemeToggle} title="Cambiar tema" type="button">
        {theme === "dark" ? <Sun size={17} strokeWidth={2.2} /> : <Moon size={17} strokeWidth={2.2} />}
      </button>

      <section className="auth-layout">
        <div className="auth-copy">
          <img className="auth-logo" src="/trazza.png" alt="Trazza" />
          <p className="auth-kicker">Hecho por traders, para traders</p>
          <h1>{isSignup ? "Crea tu cuenta en Trazza" : "Entra en Trazza"}</h1>
          <p>
            Gestiona tus finanzas, tu journal y tus metricas de trading desde un workspace pensado para operar con claridad.
          </p>
        </div>

        <section className="auth-card" aria-label={isSignup ? "Crear cuenta" : "Iniciar sesion"}>
          <div className="auth-heading">
            <span>{isSignup ? "Beta gratuita" : "Acceso seguro"}</span>
            <h2>{isSignup ? "Empieza con tu cuenta real" : "Continua con tu cuenta"}</h2>
            <p>{isSignup ? "Recibiras un email para confirmar el acceso." : "Usa el email con el que tienes acceso a Trazza."}</p>
          </div>

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;

              if (isSignup) {
                void onSignUp({ fullName, email, password });
                return;
              }

              void onSignIn({ email, password });
            }}
          >
            {isSignup && (
              <label>
                <span>Nombre</span>
                <div className="auth-field">
                  <UserRound size={17} strokeWidth={2.2} />
                  <input
                    autoComplete="name"
                    minLength={2}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Tu nombre"
                    required
                    type="text"
                    value={fullName}
                  />
                </div>
              </label>
            )}

            <label>
              <span>Email</span>
              <div className="auth-field">
                <Mail size={17} strokeWidth={2.2} />
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@email.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
            </label>

            <label>
              <span>Contrasena</span>
              <div className="auth-field">
                <LockKeyhole size={17} strokeWidth={2.2} />
                <input
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimo 6 caracteres"
                  required
                  type="password"
                  value={password}
                />
              </div>
            </label>

            {message && <p className={`auth-message ${message.type}`}>{message.text}</p>}

            <button className="primary-action" disabled={busy} type="submit">
              {busy ? "Procesando..." : isSignup ? "Crear cuenta" : "Entrar"}
            </button>
          </form>

          <button className="auth-switch" disabled={busy} onClick={() => setMode(isSignup ? "signin" : "signup")} type="button">
            {isSignup ? "Ya tengo cuenta" : "Crear cuenta gratis"}
          </button>
        </section>
      </section>

      <section className="auth-preview" aria-hidden="true">
        <img className="auth-preview-image auth-preview-dark" src="/login-dashboard.png" alt="" />
        <img className="auth-preview-image auth-preview-light" src="/login-dashboard-light.png" alt="" />
      </section>
    </main>
  );
}
