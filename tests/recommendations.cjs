const assert = require("node:assert/strict");
(async () => {
  const { recommendServices } = await import("../web/src/shared/recommendations.js");
  const services = [
    { id: "a1", slug: "a", negocio: { rubro: "barberia" } },
    { id: "a2", slug: "a", negocio: { rubro: "barberia" } },
    { id: "a3", slug: "a", negocio: { rubro: "barberia" } },
    { id: "b1", slug: "b", negocio: { rubro: "manicura" } },
    { id: "c1", slug: "c", negocio: { rubro: "consultoria" } },
  ];
  assert.equal(recommendServices(services, { favorites: ["b"] })[0].slug, "b");
  assert.equal(recommendServices(services, { serviceFavorites: ["a2"] })[0].id, "a2", "saving one service does not boost all its siblings");
  assert.equal(recommendServices(services, { interests: ["consultoria"] })[0].slug, "c");
  assert.equal(recommendServices(services, { appointments: [{ slug: "b", estado: "completado", fecha: "2026-01-01" }] })[0].slug, "b");
  assert.equal(recommendServices(services, { appointments: [{ slug: "b", estado: "cancelado", fecha: "2026-01-01" }] })[0].slug, "a");
  const ranked = recommendServices(services, { favorites: ["a"], limit: 4 });
  assert.equal(ranked.filter(service => service.slug === "a").length, 2, "discovery keeps room for other businesses");
  assert.equal(recommendServices(services, { distance: service => service.slug === "c" ? 1 : Infinity })[0].slug, "c");
  assert.deepEqual(recommendServices([]), []);
  assert.equal(services[0].id, "a1", "ranking does not reorder the original catalog");
  console.log("PASS recommendations: favorites, onboarding interests, completed bookings, distance and business diversity; cancellations do not boost ranking.");
})().catch(error => { console.error(error); process.exitCode = 1; });
