import { useState } from "react";
import { LockKeyhole, Languages, Mail, Moon, Sun, UserRound } from "lucide-react";
import { useI18n, useT } from "../lib/i18n/context";

type AuthScreenProps = {
  busy: boolean;
  message?: {
    type: "info" | "success" | "error";
    text: string;
  } | null;
  theme: "dark" | "light";
  onForgotPassword: (email: string) => Promise<boolean>;
  onSignIn: (credentials: { email: string; password: string }) => Promise<void>;
  onSignUp: (credentials: { fullName: string; email: string; password: string }) => Promise<void>;
  onThemeToggle: () => void;
};

export function AuthScreen({ busy, message, onForgotPassword, onSignIn, onSignUp, onThemeToggle, theme }: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
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
        <div className="auth-copy">
          <img className="auth-logo" src="/trazza.png" alt="Trazza" />
          <p className="auth-kicker">{t("auth.kicker")}</p>
          <h1>{isForgot ? t("auth.title.forgot") : isSignup ? t("auth.title.signup") : t("auth.title.signin")}</h1>
          <p>{t("auth.subtitle")}</p>
        </div>

        <section className="auth-card" aria-label={isForgot ? t("auth.badge.forgot") : isSignup ? t("auth.badge.signup") : t("auth.badge.signin")}>
          <div className="auth-heading">
            <span>{isForgot ? t("auth.badge.forgot") : isSignup ? t("auth.badge.signup") : t("auth.badge.signin")}</span>
            <h2>{isForgot ? t("auth.heading.forgot") : isSignup ? t("auth.heading.signup") : t("auth.heading.signin")}</h2>
            <p>{isForgot ? t("auth.copy.forgot") : isSignup ? t("auth.copy.signup") : t("auth.copy.signin")}</p>
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

      <section className="auth-preview" aria-hidden="true">
        <img className="auth-preview-image auth-preview-dark" src="/login-dashboard.png" alt="" />
        <img className="auth-preview-image auth-preview-light" src="/login-dashboard-light.png" alt="" />
      </section>
    </main>
  );
}
