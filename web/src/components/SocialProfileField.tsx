import * as React from "react";
import { normalizarEnlaceRed, type SocialKey } from "../shared/socials.js";
import { SocialIcon } from "./SocialIcon";

const prefixes: Record<SocialKey, string> = {
  instagram: "instagram.com/",
  facebook: "facebook.com/",
  tiktok: "tiktok.com/@",
  youtube: "youtube.com/@",
  x: "x.com/",
  linkedin: "linkedin.com/company/",
  whatsapp: "wa.me/",
};
function splitProfile(key: SocialKey, value: string) {
  const empty = { prefix: prefixes[key], username: "" };
  if (!value) return empty;
  try {
    const url = new URL(normalizarEnlaceRed(key, value));
    if (key === "whatsapp")
      return {
        ...empty,
        username:
          url.hostname === "api.whatsapp.com"
            ? url.searchParams.get("phone") || ""
            : url.pathname.replaceAll("/", ""),
      };
    const path = url.pathname.replace(/^\//, "").replace(/\/$/, "");
    // Keep existing channel IDs, personal LinkedIn profiles and Facebook IDs.
    if (key === "youtube" && !path.startsWith("@")) {
      const [kind, ...rest] = path.split("/");
      return { prefix: `youtube.com/${kind}/`, username: rest.join("/") };
    }
    if (key === "linkedin") {
      const [kind, ...rest] = path.split("/");
      if (["company", "in", "school"].includes(kind))
        return { prefix: `linkedin.com/${kind}/`, username: rest.join("/") };
      return { prefix: "linkedin.com/", username: path + url.search };
    }
    return {
      ...empty,
      username: path.replace(/^@/, "") + url.search,
    };
  } catch {
    return { ...empty, username: value };
  }
}

export function SocialProfileField({
  network,
  value,
  disabled,
  onChange,
}: {
  network: { key: SocialKey; label: string };
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [field, setField] = React.useState(() =>
    splitProfile(network.key, value),
  );
  const emitted = React.useRef(value);
  React.useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setField(splitProfile(network.key, value));
    }
  }, [value, network.key]);
  const update = (username: string, prefix = field.prefix) => {
    setField({ username, prefix });
    const full = username ? `https://${prefix}${username}` : "";
    emitted.current = full;
    onChange(full);
  };
  return (
    <label className="negocio-field">
      {network.label}
      <span className={`negocio-social-input${disabled ? " is-disabled" : ""}`}>
        <SocialIcon name={network.key} />
        <span className="negocio-social-prefix" aria-hidden="true">
          {field.prefix}
        </span>
        <input
          aria-label={`Usuario de ${network.label}`}
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode={network.key === "whatsapp" ? "tel" : "text"}
          maxLength={network.key === "instagram" ? 200 : 300}
          placeholder={
            network.key === "whatsapp" ? "543511234567" : "tu.negocio"
          }
          value={field.username}
          disabled={disabled}
          onChange={(e) => update(e.target.value.replace(/^@/, ""))}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").trim();
            if (
              /^(?:https?:\/\/|(?:www\.)?[\w.-]+\.com\/|wa\.me\/)/i.test(text)
            ) {
              try {
                const parsed = splitProfile(
                  network.key,
                  normalizarEnlaceRed(network.key, text),
                );
                e.preventDefault();
                update(parsed.username, parsed.prefix);
              } catch {
                // Keep invalid pasted text visible for correction and save validation.
              }
            }
          }}
        />
      </span>
      {network.key === "whatsapp" && (
        <small className="negocio-muted">
          Número con código de país, sin + ni espacios.
        </small>
      )}
    </label>
  );
}
