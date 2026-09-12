import { useState } from "react";
import { LockKeyhole, Languages, Mail, Moon, Sun, UserRound } from "lucide-react";
import { useI18n, useT } from "../lib/i18n/context";
import { Wordmark } from "./Wordmark";

type AuthScreenProps = {
  busy: boolean;
  /* Con que pestaña abre. Por defecto "signin", que es lo que quiere quien ya tiene
     cuenta; la landing manda "signup" desde sus botones de alta para que el visitante
     no tenga que buscar el enlace de registro despues de haber pulsado "Crear cuenta". */
  initialMode?: "signin" | "signup";
  message?: {
    type: "info" | "success" | "error";
    text: string;
  } | null;
  theme: "dark" | "light";
  onForgotPassword: (email: string) => Promise<boolean>;
  onGoogleSignIn: () => Promise<void>;
  onSignIn: (credentials: { email: string; password: string }) => Promise<void>;
  onSignUp: (credentials: { fullName: string; email: string; password: string }) => Promise<void>;
  onThemeToggle: () => void;
};

export function AuthScreen({
  busy,
  initialMode = "signin",
  message,
  onForgotPassword,
  onGoogleSignIn,
  onSignIn,
  onSignUp,
  onThemeToggle,
  theme,
}: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode);
  const [fullName, setFullName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const t = useT();
  const { language, setLanguage } = useI18n();

  return (
    <main className="auth-screen">
      <Wordmark className="auth-logo" />

      <div className="auth-top-actions">
        <button
          className="auth-theme-toggle"
          onClick={() => setLanguage(language === "es" ? "en" : "es")}
          title={t("appShell.topbar.language")}
          type="button"
        >
          <Languages size={17} strokeWidth={2.2} />
          <span>{language.toUpperCase()}</span>
        </button>
        <button className="auth-theme-toggle" onClick={onThemeToggle} title={t("appShell.topbar.theme")} type="button">
          {theme === "dark" ? <Sun size={17} strokeWidth={2.2} /> : <Moon size={17} strokeWidth={2.2} />}
        </button>
      </div>

      <section className="auth-layout">
        <section className="auth-card" aria-label={isForgot ? t("auth.heading.forgot") : isSignup ? t("auth.heading.signup") : t("auth.heading.signin")}>
          <div className="auth-heading">
            <h2>{isForgot ? t("auth.heading.forgot") : isSignup ? t("auth.heading.signup") : t("auth.heading.signin")}</h2>
          </div>

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;

              if (isForgot) {
                void onForgotPassword(email);
                return;
              }

              if (isSignup) {
                void onSignUp({ fullName, email, password });
                return;
              }

              void onSignIn({ email, password });
            }}
          >
            {isSignup && (
              <label>
                <span>{t("auth.field.name")}</span>
                <div className="auth-field">
                  <UserRound size={17} strokeWidth={2.2} />
                  <input
                    autoComplete="name"
                    minLength={2}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder={t("auth.field.namePlaceholder")}
                    required
                    type="text"
                    value={fullName}
                  />
                </div>
              </label>
            )}

            <label>
              <span>{t("auth.field.email")}</span>
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

            {!isForgot && (
              <label>
                <span>{t("auth.field.password")}</span>
                <div className="auth-field">
                  <LockKeyhole size={17} strokeWidth={2.2} />
                  <input
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t("auth.field.passwordPlaceholder")}
                    required
                    type="password"
                    value={password}
                  />
                </div>
              </label>
            )}

            {!isSignup && !isForgot && (
              <button
                className="auth-forgot-link"
                disabled={busy}
                onClick={() => setMode("forgot")}
                type="button"
              >
                {t("auth.forgotLink")}
              </button>
            )}

            {isSignup && (
              <label className="auth-terms">
                <input
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  required
                  type="checkbox"
                />
                <span>
                  {t("auth.terms.prefix")}{" "}
                  <a href="/legal.html#terminos" rel="noopener" target="_blank">
                    {t("auth.terms.terms")}
                  </a>{" "}
                  {t("auth.terms.and")}{" "}
                  <a href="/legal.html#privacidad" rel="noopener" target="_blank">
                    {t("auth.terms.privacy")}
                  </a>
                  .
                </span>
              </label>
            )}

            {message && <p className={`auth-message ${message.type}`}>{message.text}</p>}

            <button className="primary-action" disabled={busy} type="submit">
              {busy ? t("auth.submit.processing") : isForgot ? t("auth.submit.forgot") : isSignup ? t("auth.submit.signup") : t("auth.submit.signin")}
            </button>
          </form>

          {!isForgot && (
            <>
              <div className="auth-divider" role="separator">
                <span>{t("auth.google.divider")}</span>
              </div>

              <button
                className="auth-google-button"
                disabled={busy}
                onClick={() => {
                  if (busy) return;
                  void onGoogleSignIn();
                }}
                type="button"
              >
                <svg className="auth-google-icon" viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2582h2.9086c1.7018-1.5668 2.6836-3.874 2.6836-6.6127z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9086-2.2582c-.806.54-1.8368.859-3.0478.859-2.344 0-4.3282-1.5832-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.964 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C15.4632.8918 13.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
                  />
                </svg>
                <span>{t("auth.google.button")}</span>
              </button>

              <p className="auth-google-legal">
                {t("auth.google.legalPrefix")}{" "}
                <a href="/legal.html#terminos" rel="noopener" target="_blank">
                  {t("auth.terms.terms")}
                </a>{" "}
                {t("auth.terms.and")}{" "}
                <a href="/legal.html#privacidad" rel="noopener" target="_blank">
                  {t("auth.terms.privacy")}
                </a>
                .
              </p>
            </>
          )}

          <button
            className="auth-switch"
            disabled={busy}
            onClick={() => {
              setTermsAccepted(false);
              setMode(isForgot ? "signin" : isSignup ? "signin" : "signup");
            }}
            type="button"
          >
            {isForgot ? t("auth.switch.backToSignin") : isSignup ? t("auth.switch.haveAccount") : t("auth.switch.createAccount")}
          </button>
        </section>
      </section>
    </main>
  );
}
