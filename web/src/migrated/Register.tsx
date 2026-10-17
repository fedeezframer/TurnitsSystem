import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ACCOUNT_CATEGORIES } from "../shared/categories.js";
import "./Register.css";

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
function detailsError(fields: Fields, type: AccountType) {
  if (!fields.nombre_persona.trim() || !fields.apellido.trim())
    return "Completá tu nombre y apellido.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(fields.email)))
    return "Revisá tu correo electrónico.";
  if (!/^[0-9]{7,15}$/.test(fields.telefono.replace(/[\s()+-]/g, "")))
    return "Ingresá un teléfono de 7 a 15 dígitos, con código de área.";
  if (
    fields.password.length < 6 ||
    new TextEncoder().encode(fields.password).length > 72
  )
    return "La contraseña debe tener al menos 6 caracteres y no superar 72 bytes.";
  if (
    type === "negocio" &&
    (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(fields.usuario) ||
      fields.usuario.endsWith("-"))
  )
    return "El usuario del enlace debe tener entre 2 y 60 letras minúsculas, números o guiones.";
  return "";
}
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 3)}${"*".repeat(Math.max(3, Math.min(12, name.length - 3)))}@${domain}`;
}
function CategoryIcon({ icon }: { icon: string }) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon === "moustache" ? (
        <path
          fill="currentColor"
          stroke="none"
          d="M16 12c-4-6-9 6-15 1 0 10 12 13 15 5 3 8 15 5 15-5-6 5-11-7-15-1Z"
        />
      ) : icon === "nails" ? (
        <path d="m5 26 3-9L19 6a3 3 0 0 1 4 4L12 21l-7 5Zm6-6 11-11M6 25h12l9-9a3 3 0 0 0-4-4L12 23M7 18l4 3M25 3v4m-2-2h4m0 4v3m-2-1h4" />
      ) : icon === "wheel" ? (
        <>
          <circle cx="16" cy="16" r="13" />
          <circle cx="16" cy="16" r="3" />
          <path d="M4 12c6-3 18-3 24 0M13 18l-2 10m8-10 2 10" />
        </>
      ) : icon === "scissors" ? (
        <>
          <circle cx="8" cy="24" r="4" />
          <circle cx="24" cy="24" r="4" />
          <path d="m10 20 13-17M22 20 9 3m7 9v4" />
        </>
      ) : icon === "tie" ? (
        <path d="M13 3h6l-1 5h-4l-1-5Zm1 9h4l4 13-6 5-6-5 4-13Zm-2 9 7-5" />
      ) : (
        <path strokeWidth="3.5" d="M8 16h16M16 8v16" />
      )}
    </svg>
  );
}
function AccountArt({ business }: { business?: boolean }) {
  return (
    <svg
      className="registration-art"
      viewBox={business ? "1095 495 275 215" : "585 495 225 215"}
      aria-hidden="true"
    >
      <image
        href="/assets/registration/account-choices.jpg"
        width="1920"
        height="945"
      />
    </svg>
  );
}
export default function Register({
  baseUrl = "https://negosocio.onrender.com",
  termsUrl = "/terminos",
  privacyUrl = "/privacidad",
}: any) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<AccountType>("usuario");
  const [fields, setFields] = useState<Fields>(empty);
  const [categories, setCategories] = useState<string[]>([]);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [registrationId, setRegistrationId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const lock = useRef(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const title = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  const detailsComplete = !detailsError(fields, type);
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
    else if (step !== 1) title.current?.focus();
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
  function chooseType(next: AccountType) {
    setType(next);
    setCategories([]);
    setError("");
    setStep(2);
  }
  function nextDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const invalid = detailsError(fields, type);
    if (invalid) {
      setError(invalid);
      return;
    }
    setStep(3);
  }
  async function start(selected: string[]) {
    if (lock.current || !selected.length) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        nombre_persona: fields.nombre_persona.trim(),
        apellido: fields.apellido.trim(),
        email: cleanEmail(fields.email),
        telefono: fields.telefono,
        password: fields.password,
      };
      const result = await post(
        type === "usuario"
          ? "/consumidores/registro/iniciar"
          : "/registro/iniciar",
        type === "usuario"
          ? { ...payload, intereses: selected }
          : {
              ...payload,
              usuario: fields.usuario,
              business_name: fields.usuario,
              rubros: selected,
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
  function chooseCategory(id: string) {
    if (busy) return;
    setError("");
    if (type === "negocio") {
      setCategories([id]);
      void start([id]);
    } else
      setCategories((values) =>
        values.includes(id)
          ? values.filter((value) => value !== id)
          : [...values, id],
      );
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
    window.location.replace(
      consumer ? "/browse" : `/panel/${encodeURIComponent(result.slug)}`,
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
  function field(
    key: keyof Fields,
    label: string,
    inputType = "text",
    autoComplete?: string,
  ) {
    return (
      <label className="registration-field">
        {label}
        <input
          name={key}
          type={inputType}
          autoComplete={autoComplete}
          required
          maxLength={key === "email" ? 254 : key === "usuario" ? 60 : 80}
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
          aria-describedby={error ? "registration-error" : undefined}
        />
        {key === "usuario" && (
          <small>turnits.com/agenda/{fields.usuario || "tu-usuario"}</small>
        )}
      </label>
    );
  }
  return (
    <div className={`registration registration-step-${step}`}>
      <header className="registration-header">
        <Link to="/" aria-label="Turnits, inicio">
          turnits
        </Link>
      </header>
      {step > 1 && (
        <button
          className="registration-back"
          type="button"
          disabled={busy}
          onClick={() => {
            setStep(step - 1);
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
          {step === 1
            ? "¿Qué tipo de cuenta quieres crear?"
            : step === 2
              ? type === "usuario"
                ? "Completa tu perfil"
                : "Completa tu negocio"
              : step === 3
                ? type === "usuario"
                  ? "¿Qué rubro te interesa?"
                  : "¿Qué rubro de negocio es?"
                : "Verifica tu perfil"}
        </h1>
        {step !== 3 && (
          <p className="registration-subtitle">
            {step === 1 ? (
              "Para ajustar tu experiencia al máximo"
            ) : step === 2 ? (
              "Tus datos aseguran el funcionamiento de la agenda"
            ) : (
              <>
                Hemos enviado un código a {maskEmail(cleanEmail(fields.email))}
              </>
            )}
          </p>
        )}
        {step === 1 && (
          <div className="registration-accounts">
            <button
              type="button"
              className="registration-account"
              onClick={() => chooseType("usuario")}
            >
              <strong>Usuario</strong>
              <span>Administra y reserva turnos</span>
              <AccountArt />
            </button>
            <button
              type="button"
              className="registration-account"
              onClick={() => chooseType("negocio")}
            >
              <strong>Negocio</strong>
              <span>Ofrece tus servicios y obtene tu agenda</span>
              <AccountArt business />
            </button>
          </div>
        )}
        {step === 2 && (
          <form className={`registration-form ${type}`} onSubmit={nextDetails}>
            {field("nombre_persona", "Nombre", "text", "given-name")}
            {field("apellido", "Apellido", "text", "family-name")}
            {field("email", "Correo Electrónico", "email", "email")}
            {field("telefono", "Número Telefónico", "tel", "tel")}
            {type === "negocio" &&
              field("usuario", "Usuario", "text", "username")}
            {field("password", "Contraseña", "password", "new-password")}
            <button
              className="registration-next registration-reveal"
              type="submit"
              data-ready={detailsComplete}
              disabled={!detailsComplete}
              aria-hidden={!detailsComplete}
              aria-describedby="registration-consent"
            >
              Siguiente
            </button>
            <p className="registration-consent" id="registration-consent">
              Al presionar «Siguiente», aceptás los{" "}
              <a href={termsUrl} target="_blank" rel="noreferrer">
                Términos y condiciones
              </a>{" "}
              y la{" "}
              <a href={privacyUrl} target="_blank" rel="noreferrer">
                Política de privacidad
              </a>
              .
            </p>
          </form>
        )}
        {step === 3 && (
          <>
            <div
              className="registration-categories"
              role="group"
              aria-label={
                type === "negocio" ? "Elegí un rubro" : "Elegí tus intereses"
              }
            >
              {ACCOUNT_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={categories.includes(category.id)}
                  className="registration-category"
                  disabled={busy}
                  onClick={() => chooseCategory(category.id)}
                >
                  <CategoryIcon icon={category.icon} />
                  {category.label}
                </button>
              ))}
            </div>
            {type === "usuario" && (
              <button
                className="registration-next registration-interests-next registration-reveal"
                type="button"
                data-ready={categories.length > 0}
                aria-hidden={categories.length === 0}
                disabled={busy || !categories.length}
                onClick={() => void start(categories)}
              >
                {busy ? "Enviando código…" : "Siguiente"}
              </button>
            )}
            {type === "negocio" && busy && (
              <p role="status" className="registration-status">
                Enviando código…
              </p>
            )}
          </>
        )}
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
  );
}
