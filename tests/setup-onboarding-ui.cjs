// Run against a local Vite server; every API request is intercepted.
const assert = require("node:assert/strict"), path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.SETUP_TEST_URL || "http://127.0.0.1:4182";
const output = process.env.SETUP_SCREENSHOTS;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const context = await browser.newContext({ reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [], writes = [];
  page.on("pageerror", error => errors.push(error.message));
  let complete = false, failed = false, fresh = false, missing = "pagos";
  const settings = () => ({ slug: "demo", activo: true, plan: "basico", business_name: "Demo", estado_suscripcion: "activa",
    mp_status: complete ? "Conectado" : "Desconectado", metodo_pago: "sena", porcentaje_sena: 30,
    horarios: fresh || missing === "horarios" ? {} : { lunes: { activo: true, jornada: ["09:00", "18:00"], descanso: [null, null] } }, excepciones: [] });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    const api = url.pathname.startsWith("/api/") || url.hostname === "negosocio.onrender.com";
    if (!api) return url.origin === base ? route.continue() : route.abort();
    const endpoint = url.pathname.replace(/^\/api/, "");
    if (request.method() !== "GET") writes.push({ endpoint, body: request.postDataJSON() });
    let body = { success: true, active: true, rol: "owner", slug: "demo", settings: settings(),
      servicios: fresh || missing === "servicios" ? [] : [{ id: "service", nombre: "Corte", precio: 8500, duracion: 30, activo: true }],
      equipo: [], turnos: [], turnosLista: [], notificaciones: [], no_leidas: 0, planes: [], mensajes: [],
      turnosMes: 0, turnosHoy: 0, totalClientes: 0, clientesNuevos: 0, turnosMesAnterior: 0,
      logros: {}, ventas: {}, chartData: [], ventasPorDia: {}, negocios: [], consultas: [], promociones: [] };
    if (endpoint === "/registro/iniciar") body = { success: true, registro_id: "test-only" };
    if (endpoint === "/negocio/demo") body = { success: true, negocio: { modo_agenda: "normal" } };
    const status = failed && endpoint.startsWith("/admin/servicios/") ? 503 : 200;
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  try {
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + "/registro/negocio");
      await page.getByRole("button", { name: "Continuar", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Continuar", exact: true }).isVisible(), true);
      assert.equal(await page.getByRole("button", { name: "Continuar", exact: true }).isEnabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (output) await page.screenshot({ path: path.join(output, `Turnits-registro-sencillo-${width}.png`), fullPage: true });
    }
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Ana");
    await page.getByRole("textbox", { name: "Apellido", exact: true }).fill("Prueba");
    const phone = page.locator('input[name="telefono"]');
    await phone.pressSequentially("3511234567899999");
    assert.equal(await phone.inputValue(), "3511234567", "Argentina stops at ten national digits");
    await phone.evaluate(input => {
      const clipboardData = new DataTransfer(); clipboardData.setData("text/plain", "+5493511234567");
      input.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
    });
    assert.equal(await phone.inputValue(), "93511234567", "pasting preserves Argentina's international mobile prefix");
    await phone.evaluate(input => {
      const clipboardData = new DataTransfer(); clipboardData.setData("text/plain", "+54 351 123456789999");
      input.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
    });
    assert.equal(await phone.inputValue(), "93511234567", "overlong paste cannot silently change the phone number");
    await page.getByRole("combobox", { name: "País del teléfono" }).selectOption("UY");
    assert.equal(await phone.getAttribute("maxlength"), "8");
    await page.getByRole("combobox", { name: "País del teléfono" }).selectOption("AR");
    await phone.fill("3511234567");
    await page.locator('input[name="email"]').fill("ana@example.invalid");
    await page.locator('input[name="usuario"]').fill("demo");
    await page.locator('input[name="password"]').fill("1234567");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.locator("#registration-error").waitFor();
    assert.equal(writes.length, 0, "invalid details do not submit");
    await page.locator('input[name="password"]').fill("test1234");
    await page.getByRole("button", { name: "Mostrar contraseña", exact: true }).click();
    assert.equal(await page.locator('input[name="password"]').getAttribute("type"), "text");
    assert.equal(await page.locator('input[name="password"]').inputValue(), "test1234");
    assert.equal(writes.length, 0, "the eye does not submit the form");
    await page.getByRole("button", { name: "Ocultar contraseña", exact: true }).click();
    assert.equal(await page.locator('input[name="password"]').getAttribute("type"), "password");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("button", { name: "Barbería", exact: true }).click();
    assert.equal(writes.length, 0, "choosing a category does not create a registration");
    await page.getByRole("button", { name: "Enviar código a mi email" }).click();
    await page.getByRole("heading", { name: "Verificá tu email" }).waitFor();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].endpoint, "/registro/iniciar");

    const claims = Buffer.from(JSON.stringify({ slug: "demo", rol: "owner", negocioId: "test", iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url");
    await page.addInitScript(token => {
      localStorage.setItem("access_token", token); localStorage.setItem("user_slug", "demo");
      localStorage.setItem("account_type", "negocio");
      if (location.search.includes("tutorial=1")) localStorage.removeItem("onboarding_omitido_demo");
      else localStorage.setItem("onboarding_omitido_demo", "1");
    }, `e30.${claims}.test`);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + "/panel/demo");
      await page.locator('.setup-guide[data-completed="2"]').waitFor();
      await page.locator("#turnits-startup-preloader").waitFor({ state: "hidden" });
      const guide = page.locator(".setup-guide");
      assert.equal(await guide.getByRole("button", { name: "Ir a Pagos", exact: true }).count(), 1);
      assert.equal(await guide.locator(".setup-guide-eyebrow, .setup-guide-count").count(), 0);
      assert.equal(await guide.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await guide.locator(".setup-guide-art").evaluate(image => image.decode());
      assert.equal(await guide.locator(".setup-guide-art").evaluate(image => image.naturalWidth > 0), true);
      if (output) {
        await guide.screenshot({ path: path.join(output, `Turnits-inicio-guia-${width}.png`) });
        await page.screenshot({ path: path.join(output, `Turnits-inicio-integrado-${width}.png`) });
      }
    }
    for (const [step, asset] of [["servicios", "services"], ["horarios", "calendar"], ["pagos", "payments"]]) {
      console.log('Checking artwork:', step);
      missing = step;
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(base + "/panel/demo");
        const guide = page.locator(`.setup-guide[data-step="${step}"]`);
        await guide.waitFor();
        await page.locator("#turnits-startup-preloader").waitFor({state:"hidden"});
        const art = guide.locator('.setup-guide-art');
        await art.evaluate(image => image.decode());
        assert.ok((await art.getAttribute('src')).endsWith(`setup-${asset}.webp`));
        assert.equal(await guide.getByRole('button').count(), 1);
        assert.equal(await guide.evaluate(element => element.scrollWidth <= element.clientWidth), true);
        if (output) await guide.screenshot({path: path.join(output, `Turnits-aviso-${step}-${width}.png`)});
      }
    }
    await page.locator(".setup-guide").getByRole("button", { name: "Ir a Pagos", exact: true }).click();
    await page.locator(".setup-guide").waitFor({ state: "detached" });
    complete = true;
    await page.goto(base + "/panel/demo");
    await page.locator("#turnits-startup-preloader").waitFor({ state: "hidden" });
    await page.locator(".setup-guide").waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Copiar link de tu agenda", exact: true }).first().click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "https://turnits.com/agenda/demo");
    if (output) await page.screenshot({ path: path.join(output, "Turnits-inicio-listo.png") });
    failed = true;
    await page.reload();
    await page.getByRole("button", { name: "Reintentar", exact: true }).waitFor();
    assert.equal(await page.locator(".setup-guide").getByRole("button", { name: "Ir a Pagos", exact: true }).count(), 0);
    failed = false;
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await page.locator(".setup-guide").waitFor({ state: "detached" });
    fresh = true; complete = false;
    await page.goto(base + "/panel/demo?tutorial=1");
    await page.locator(".tn-onb-root").waitFor();
    await page.getByText("Creá tu primer servicio", { exact: true }).waitFor();
    await page.locator("#turnits-startup-preloader").waitFor({state:"hidden"});
    assert.equal(await page.locator(".setup-guide").count(), 0, "the reminder does not replace or appear before the original tutorial");
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({width, height: 900});
      const card = page.locator('.tn-onb-card[data-step="servicios"]');
      await card.locator('img').evaluate(image => image.decode());
      assert.equal(await card.evaluate(element => element.scrollWidth <= element.clientWidth), true);
      if (output) await card.screenshot({path: path.join(output, `Turnits-tutorial-servicios-${width}.png`)});
    }
    await page.getByRole("button", { name: "Seguir después desde Inicio" }).click();
    await page.locator(".tn-onb-root").waitFor({ state: "detached" });
    await page.locator('.setup-guide[data-completed="0"]').waitFor();
    await page.getByRole("heading", { name: "Sumá tu primer servicio" }).waitFor();
    assert.equal(await page.locator(".setup-guide").getByRole("button", { name: "Agregar servicio", exact: true }).isVisible(), true);
    assert.deepEqual(errors, []);
    assert.equal(writes.length, 1, "guide and retry never mutate settings or services");
    await page.goto(base + "/panel/demo?tutorial=1");
    await page.getByLabel('Nombre del servicio', {exact:true}).fill('Corte de prueba');
    await page.getByLabel('Precio total del servicio').fill('8500');
    await page.getByRole('button', {name:'Crear y continuar',exact:true}).click();
    for (const step of ['horarios', 'pagos']) {
      const card = page.locator(`.tn-onb-card[data-step="${step}"]`);
      await card.waitFor();
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({width,height:900});
        await card.locator('img').evaluate(image => image.decode());
        assert.equal(await card.evaluate(element => element.scrollWidth <= element.clientWidth), true);
        if (output) await card.screenshot({path:path.join(output, `Turnits-tutorial-${step}-${width}.png`)});
      }
      if (step === 'horarios') await page.getByRole('button', {name:'Guardar y continuar',exact:true}).click();
    }
    assert.equal(writes.length, 3, 'tutorial writes only the explicitly submitted service and schedule, all intercepted');
    console.log("PASS local UI: visible actions, actionable validation, category confirmation, one mocked registration, skipped onboarding recovery, progress, navigation, ready/share, failure/retry, mobile/desktop; no external writes.");
  } catch (error) { console.error('UI failure:', error); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });


