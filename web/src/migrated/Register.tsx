import { validRegistrationPassword, REGISTRATION_PASSWORD_ERROR, PASSWORD_MIN_LENGTH } from "../shared/password-policy.js";
import { PHONE_COUNTRIES, phoneLimit, validNationalPhone, parsePhoneInput, phoneHint } from "../shared/phone-policy.js";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import "./Register.css";
import { appConfig } from "../config";
import { readQuoteBookingDraft } from "../shared/quote-booking-draft";
import { safeMessagesReturn } from "../shared/consultation-session.js";
import arrowUpRightIcon from "../components/akar-icons-arrow-up-right.svg";

type AccountType = "usuario" | "negocio";
type Fields = {
  nombre_persona: string;
  apellido: string;
  email: string;
  telefono: string;
  usuario: string;
  password: string;
};
const empty: Fields = {
  nombre_persona: "",
  apellido: "",
  email: "",
  telefono: "",
  usuario: "",
  password: "",
};
const cleanEmail = (email: string) => email.trim().toLowerCase();
function internationalPhone(
  number: string,
  country: (typeof PHONE_COUNTRIES)[number],
) {
  if (!/^[\d\s()-]+$/.test(number)) return "";
  const national = number.replace(/\D/g, "");
  return validNationalPhone(national, country.code) ? country.dial.slice(1) + national : "";
}
function detailsError(fields: Fields, type: AccountType, phone: string) {
  if (!fields.nombre_persona.trim() || !fields.apellido.trim())
    return "Completá tu nombre y apellido.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(fields.email)))
    return "Revisá tu correo electrónico.";
  if (!/^[0-9]{7,15}$/.test(phone))
    return "Elegí el país e ingresá tu teléfono con código de área.";
  if (!validRegistrationPassword(fields.password)) return REGISTRATION_PASSWORD_ERROR;
  if (type === "negocio" && ['admin', 'agenda', 'agenda-test', 'alert', 'api', 'app', 'assets', 'browse', 'cambiar-contrasena', 'cambiar-contraseña', 'consultas', 'error', 'internal', 'login', 'login-test', 'panel', 'panel-test', 'pendiente', 'perfil', 'planes', 'politica-de-privacidad', 'privacidad', 'public', 'register', 'register-test', 'registro', 'renovar', 'reprogramar', 'store-login', 'success', 'sucess', 'terminos', 'terminos-y-condiciones', 'test'].includes(fields.usuario)) return "Ese usuario está reservado. Elegí otro para tu enlace.";
  if (
    type === "negocio" &&
    (!/^[a-z0-9][a-z0-9-]{1,29}$/.test(fields.usuario) ||
      fields.usuario.endsWith("-"))
  )
    return "El enlace debe tener entre 2 y 30 letras minúsculas, números o guiones.";
  return "";
}
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 3)}${"*".repeat(Math.max(3, Math.min(12, name.length - 3)))}@${domain}`;
}
export default function Register({
  baseUrl = "https://negosocio.onrender.com",
  termsUrl = "/terminos",
  privacyUrl = "/privacidad",
  accountType = "usuario",
}: any) {
  const [step, setStep] = useState(2);
  const type = accountType as AccountType;
  const [quoteDraft] = useState(() => type === "usuario" ? readQuoteBookingDraft() : null);
  const [fields, setFields] = useState<Fields>(() => quoteDraft ? {
    ...empty,
    nombre_persona: quoteDraft.nombre,
    apellido: quoteDraft.apellido,
    email: quoteDraft.email,
    telefono: quoteDraft.telefono,
  } : empty);
  const [phoneCountry, setPhoneCountry] = useState(() => PHONE_COUNTRIES.some((country) => country.code === quoteDraft?.countryCode) ? quoteDraft!.countryCode : "AR");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [registrationId, setRegistrationId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const lock = useRef(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const title = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  const selectedCountry =
    PHONE_COUNTRIES.find((country) => country.code === phoneCountry) ||
    PHONE_COUNTRIES[0];
  const phone = internationalPhone(fields.telefono, selectedCountry);
  const detailsComplete = !detailsError(fields, type, phone);
  const [plan] = useState(() => {
    const value = new URLSearchParams(window.location.search).get("plan");
    return ["gratis", "basico", "premium"].includes(value || "")
      ? value
      : "gratis";
  });
  const [referral] = useState(() => {
    try {
      const value =
        new URLSearchParams(window.location.search).get("ref") ||
        localStorage.getItem("turnits_ref") ||
        "";
      if (!/^[a-z0-9]{6,12}$/i.test(value)) return "";
      localStorage.setItem("turnits_ref", value);
      return value;
    } catch {
      return "";
    }
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (step === 4) inputs.current[0]?.focus();
    else title.current?.focus();
  }, [step]);
  async function post(path: string, body: object) {
    const controller = new AbortController();
    request.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success)
        throw new Error(
          result?.error ||
            (response.status === 429
              ? "Demasiados intentos. Esperá unos minutos y probá de nuevo."
              : "No se pudo completar la solicitud. Volvé a intentar."),
        );
      return result;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError")
        throw new Error("El servidor tardó demasiado. Volvé a intentar.");
      throw e;
    } finally {
      window.clearTimeout(timer);
    }
  }
  function nextDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const invalid = detailsError(fields, type, phone);
    if (invalid) {
      setError(invalid);
      return;
    }
    void start();
  }
  async function start() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        nombre_persona: fields.nombre_persona.trim(),
        apellido: fields.apellido.trim(),
        email: cleanEmail(fields.email),
        telefono: phone,
        password: fields.password,
      };
      const result = await post(
        type === "usuario"
          ? "/consumidores/registro/iniciar"
          : "/registro/iniciar",
        type === "usuario"
          ? { ...payload, intereses: ["otro"] }
          : {
              ...payload,
              usuario: fields.usuario,
              business_name: fields.usuario,
              ...(appConfig.quoteBookingEnabled ? { modo_agenda: "normal" } : {}),
              plan,
              ref: referral,
            },
      );
      if (mounted.current) {
        setRegistrationId(result.registro_id || "");
        setDigits(Array(6).fill(""));
        setCooldown(60);
        setStep(4);
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "No se pudo conectar al servidor.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function saveSession(result: any) {
    const consumer =
      result.rol === "consumidor" && result.tipo_cuenta === "usuario";
    if (
      typeof result.token !== "string" ||
      !result.token ||
      (type === "usuario" ? !consumer : !result.slug || consumer)
    )
      throw new Error("No se pudo iniciar tu sesión. Ingresá desde el login.");
    for (const key of [
      "access_token",
      "auth_token",
      "turnits_token",
      "user_token",
      "token",
      "user_slug",
      "auth_slug",
      "slug",
      "business_name",
      "account_type",
      "just_registered",
    ])
      localStorage.removeItem(key);
    localStorage.setItem("access_token", result.token);
    localStorage.setItem("user_email", cleanEmail(fields.email));
    localStorage.setItem("account_type", consumer ? "usuario" : "negocio");
    if (!consumer) {
      localStorage.setItem("user_slug", result.slug);
      localStorage.setItem("auth_slug", result.slug);
      localStorage.setItem(
        "business_name",
        result.business_name || fields.usuario,
      );
      localStorage.setItem("just_registered", "1");
      localStorage.removeItem("turnits_ref");
    }
    setFields((values) => ({ ...values, password: "" }));
    const requestedReturn = new URLSearchParams(window.location.search).get("volver") || "";
    const messagesReturn = safeMessagesReturn(requestedReturn, window.location.origin);
    window.location.replace(
      consumer ? messagesReturn || "/browse" : `/panel/${encodeURIComponent(result.slug)}`,
    );
  }
  async function verify(code = digits.join("")) {
    if (lock.current || !/^\d{6}$/.test(code)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await post(
        type === "usuario"
          ? "/consumidores/registro/verificar"
          : "/registro/verificar",
        {
          email: cleanEmail(fields.email),
          codigo: code,
          ...(type === "usuario" ? { registro_id: registrationId } : {}),
        },
      );
      if (mounted.current) saveSession(result);
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "No se pudo verificar el código.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function enterDigits(index: number, value: string) {
    const numbers = value.replace(/\D/g, "").slice(0, 6 - index);
    const next = [...digits];
    if (!numbers) next[index] = "";
    else for (let i = 0; i < numbers.length; i++) next[index + i] = numbers[i];
    setDigits(next);
    setError("");
    inputs.current[Math.min(5, index + numbers.length)]?.focus();
    if (next.every(Boolean)) void verify(next.join(""));
  }
  async function resend() {
    if (lock.current || cooldown) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await post(
        type === "usuario"
          ? "/consumidores/registro/reenviar-codigo"
          : "/registro/reenviar-codigo",
        {
          email: cleanEmail(fields.email),
          ...(type === "usuario" ? { registro_id: registrationId } : {}),
        },
      );
      if (mounted.current) {
        setDigits(Array(6).fill(""));
        setCooldown(60);
        setNotice("Te enviamos un nuevo código.");
        inputs.current[0]?.focus();
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "No se pudo reenviar el código.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function changePhone(value: string) {
    const parsed = parsePhoneInput(value, phoneCountry);
    if (parsed.tooLong) { setError("El teléfono tiene demasiados dígitos para el país elegido."); return; }
    setPhoneCountry(parsed.code);
    setFields((values) => ({ ...values, telefono: parsed.digits }));
    setError("");
  }
  function field(
    key: keyof Fields,
    label: string,
    inputType = "text",
    autoComplete?: string,
  ) {
    return (
      <div className="registration-field">
        <label htmlFor={`registration-${key}`}>{label}</label>
        <div className={key === "password" ? "registration-password" : undefined}>
        <input
          id={`registration-${key}`}
          name={key}
          type={key === "password" && showPassword ? "text" : inputType}
          autoComplete={autoComplete}
          required
          minLength={key === "password" ? PASSWORD_MIN_LENGTH : undefined}
          maxLength={key === "email" ? 254 : key === "usuario" ? 30 : 80}
          value={fields[key]}
          onChange={(event) => {
            setFields((values) => ({
              ...values,
              [key]:
                key === "usuario"
                  ? event.target.value.toLowerCase()
                  : event.target.value,
            }));
            setError("");
          }}
          aria-describedby={[error ? "registration-error" : "", key === "usuario" ? "registration-link-help" : "", key === "password" ? "registration-password-help" : ""].filter(Boolean).join(" ") || undefined}
        />
        {key === "password" && <button type="button" className="registration-password-toggle" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPassword && <path d="m3 3 18 18"/>}
          </svg>
        </button>}
        </div>
        {key === "usuario" && (
          <small id="registration-link-help">Tu enlace: turnits.com/{fields.usuario || "tu-negocio"}</small>
        )}
        {key === "password" && <div className="registration-password-rules" id="registration-password-help" aria-label="Requisitos de contraseña">
          <span data-met={fields.password.length >= PASSWORD_MIN_LENGTH}>8 caracteres</span>
          <span data-met={/[A-Z]/.test(fields.password)}>Mayúscula</span>
          <span data-met={/[a-z]/.test(fields.password)}>Minúscula</span>
          <span data-met={/[0-9]/.test(fields.password)}>Número</span>
          <span data-met={/[^A-Za-z0-9\s]/.test(fields.password)}>Símbolo</span>
        </div>}
      </div>
    );
  }
  return (
    <div className={`registration registration-step-${step}`}>
      <header className="registration-header">
        <Link to="/" aria-label="Turnits, inicio">
          <img src="/assets/turnits-logo-completo.png" alt="Turnits" />
        </Link>
        <Link className="registration-login" to="/login">Ya tengo cuenta <span className="registration-login-arrow" style={{ maskImage: `url(${arrowUpRightIcon})`, WebkitMaskImage: `url(${arrowUpRightIcon})` }} aria-hidden="true" /></Link>
      </header>
      <div className="registration-shell">
      <div className="registration-content">
      {step > 2 && (
        <button
          className="registration-back"
          type="button"
          disabled={busy}
          onClick={() => {
            setStep(2);
            setError("");
            setNotice("");
          }}
        >
          Volver
        </button>
      )}
      <main
        key={`${step}-${type}`}
        className="registration-main"
        aria-busy={busy}
      >
        <h1 ref={title} tabIndex={-1}>
          {step === 2
            ? type === "usuario" ? "Crea tu cuenta" : "Registra tu negocio"
            : "Verificá tu email"}
        </h1>
          <p className="registration-subtitle">
            {step === 2 ? (
              type === "usuario" ? "Encontrá servicios, descubrí negocios y reservá en Turnits." : "Creá tu cuenta y empezá a preparar tu agenda."
            ) : (
              <>
                Hemos enviado un código a {maskEmail(cleanEmail(fields.email))}
              </>
            )}
          </p>
        {step === 2 && (
          <form className={`registration-form ${type}`} noValidate onSubmit={nextDetails}>
            {field("nombre_persona", "Nombre", "text", "given-name")}
            {field("apellido", "Apellido", "text", "family-name")}
            <div className="registration-field">
              <label htmlFor="registration-phone">Número Telefónico</label>
              <div className="registration-phone">
                <div className="registration-phone-country">
                  <span aria-hidden="true">
                    <img
                      className="registration-phone-flag"
                      src={`/assets/flags/${selectedCountry.code.toLowerCase()}.svg`}
                      alt=""
                      width="24"
                      height="18"
                    />
                    {selectedCountry.dial}
                  </span>
                  <select
                    aria-label="País del teléfono"
                    autoComplete="tel-country-code"
                    value={phoneCountry}
                    onChange={(event) => {
                      setPhoneCountry(event.target.value);
                      setError("");
                    }}
                  >
                    {PHONE_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name} ({country.dial})
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  id="registration-phone"
                  name="telefono"
                  type="tel"
                  autoComplete="tel-national"
                  inputMode="tel"
                  required
                  maxLength={phoneLimit(phoneCountry, fields.telefono)}
                  placeholder={phoneCountry === "AR" ? "3515551234" : "Código de área y número"}
                  value={fields.telefono}
                  onChange={(event) => changePhone(event.target.value)}
                  onPaste={(event) => { event.preventDefault(); changePhone(event.clipboardData.getData("text")); }}
                  aria-describedby={`registration-phone-help${error ? " registration-error" : ""}`}
                />
              </div>
              <small id="registration-phone-help">{phoneHint(phoneCountry)}</small>
            </div>
            {field("email", "Correo Electrónico", "email", "email")}
            {type === "negocio" &&
              field("usuario", "Tu enlace", "text", "username")}
            {field("password", "Contraseña", "password", "new-password")}
            <div
              className="registration-actions"
              data-ready={detailsComplete}
            >
              <button
                className="registration-next"
                type="submit"
                data-ready={detailsComplete}
                disabled={busy}
                aria-describedby="registration-consent"
              >
                {busy ? "Enviando código…" : "Crear cuenta"}
              </button>
              <p className="registration-consent" id="registration-consent">
                Al presionar «Crear cuenta», aceptás los{" "}
                <a
                  href={termsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Términos y condiciones
                </a>{" "}
                y la{" "}
                <a
                  href={privacyUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Política de privacidad
                </a>
                .
              </p>
            </div>
          </form>
        )}
        {step === 2 && type === "usuario" && <p className="registration-business-link">¿Tenés un negocio? <Link to="/registro/negocio">Registralo desde acá</Link></p>}
        {step === 2 && type === "negocio" && <p className="registration-business-link">Tus clientes pueden reservar directamente desde el enlace de tu agenda.</p>}
        {step === 4 && (
          <form
            className="registration-verification"
            onSubmit={(event) => {
              event.preventDefault();
              void verify();
            }}
          >
            <div className="registration-code">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputs.current[index] = element;
                  }}
                  aria-label={`Dígito ${index + 1}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  value={digit}
                  disabled={busy}
                  onChange={(event) => enterDigits(index, event.target.value)}
                  onPaste={(event) => {
                    event.preventDefault();
                    enterDigits(index, event.clipboardData.getData("text"));
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Backspace" &&
                      !digits[index] &&
                      index > 0
                    )
                      inputs.current[index - 1]?.focus();
                    if (event.key === "ArrowLeft" && index > 0)
                      inputs.current[index - 1]?.focus();
                    if (event.key === "ArrowRight" && index < 5)
                      inputs.current[index + 1]?.focus();
                  }}
                  onFocus={(event) => event.target.select()}
                />
              ))}
            </div>
            <div className="registration-verification-actions">
              {busy ? (
                <p role="status">Verificando tu perfil…</p>
              ) : (
                <>
                  {digits.every(Boolean) && (
                    <button className="registration-text-button" type="submit">
                      Verificar código
                    </button>
                  )}
                  <button
                    className="registration-text-button"
                    type="button"
                    disabled={cooldown > 0}
                    onClick={() => void resend()}
                  >
                    {cooldown > 0
                      ? `Reenviar código en ${cooldown}s`
                      : "Reenviar código"}
                  </button>
                </>
              )}
            </div>
          </form>
        )}
        {error && (
          <p
            id="registration-error"
            className="registration-error"
            role="alert"
          >
            {error}
          </p>
        )}
        {notice && (
          <p className="registration-notice" role="status">
            {notice}
          </p>
        )}
      </main>
      </div>
      </div>
    </div>
  );
}
