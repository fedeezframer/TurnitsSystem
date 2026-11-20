import * as React from "react";
import whatsappLogo from "./whatsapp-icon.svg";
export function SocialIcon({ name }: { name: string }) {
  const profileIcons: Record<string, string> = {
    instagram: "akar-icons_instagram-fill.svg",
    facebook: "bxl_facebook.svg",
    tiktok: "akar-icons_tiktok-fill.svg",
    youtube: "ant-design_youtube-outlined.svg",
    x: "bi_twitter-x.svg",
    linkedin: "akar-icons_linkedin-fill.svg",
  };
  if (profileIcons[name])
    return <img width="22" height="22" src={`/assets/social/${profileIcons[name]}`} alt="" aria-hidden="true" />;
  if (name === "whatsapp") return <img src={whatsappLogo} width="22" height="22" alt="" aria-hidden="true" />;
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "instagram" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
        </>
      ) : name === "facebook" ? (
        <path d="M14 21v-8h3l.5-4H14V7c0-1 .5-1.5 2-1.5h2V2.2L15 2c-3 0-5 1.8-5 5v2H7v4h3v8" />
      ) : name === "tiktok" ? (
        <>
          <path d="M15 3v12.5a4.5 4.5 0 1 1-4-4.5v3a1.5 1.5 0 1 0 1 1.5V3h3c.5 3 2 4 5 4v3c-2 0-3.6-.6-5-1.8" />
        </>
      ) : name === "youtube" ? (
        <>
          <rect x="2" y="5" width="20" height="14" rx="4" />
          <path d="m10 9 5 3-5 3Z" />
        </>
      ) : name === "x" ? (
        <>
          <path d="m4 3 12 18h4L8 3ZM20 3 4 21" />
        </>
      ) : name === "linkedin" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 10v7m0-10v.1M11 17v-7m0 3c0-4 6-4 6 0v4" />
        </>
      ) : name === "phone" ? (
        <path d="m5 3 4 1 1 5-2 1a14 14 0 0 0 6 6l1-2 5 1 1 4c-8 5-22-9-16-16Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
          <path d="M3 12h18" />
        </>
      )}
    </svg>
  );
}
