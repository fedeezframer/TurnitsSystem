import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
assert(policy, "Missing enforced content security policy");
assert(!policy.includes("'unsafe-inline'") && !policy.includes("'unsafe-eval'"), "Unsafe script policy");
assert(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf("<script"), "Policy must precede scripts");
let scripts = 0;
for (const [, attributes, code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc\s*=/i.test(attributes) || !code.trim()) continue;
  const hash = `'sha256-${createHash("sha256").update(code).digest("base64")}'`;
  assert(policy.includes(hash), "Inline bootstrap script is not permitted by its CSP hash");
  scripts++;
}
assert(scripts > 0, "Bootstrap scripts were not checked");
console.log(`CSP comprobada: ${scripts} scripts de arranque con hash, sin unsafe-inline ni unsafe-eval.`);
