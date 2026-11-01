const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');

(async () => {
  const { PGlite } = require(process.env.PGLITE_MODULE_PATH);
  const db = new PGlite();
  // Same base columns as quote-booking-db; use the production account cascades.
  const fixture = fs.readFileSync('tests/quote-booking-db.cjs', 'utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1]
    .replaceAll('slug text REFERENCES usuarios(slug)', 'slug text REFERENCES usuarios(slug) ON DELETE CASCADE')
    .replace('DEFAULT gen_random_uuid(),slug text,', 'DEFAULT gen_random_uuid(),slug text REFERENCES usuarios(slug) ON DELETE CASCADE,');
  await db.exec(fixture);
  await db.exec(`CREATE TABLE reprogramaciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text REFERENCES usuarios(slug) ON DELETE CASCADE,turno_id uuid REFERENCES turnos(id));`);
  const migration = name => fs.readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
  await db.exec(migration('20261021195814_quote_booking_foundation'));
  await db.exec(migration('20261022010000_quote_payment_reconciliation'));
  await db.exec(migration('20261022011500_quote_reference_lifecycle'));
  const consumer = randomUUID();
  await db.query('INSERT INTO consumidores(id) VALUES($1)', [consumer]);
  async function seed(slug, booked = false) {
    const member = randomUUID(), service = randomUUID(), thread = randomUUID(), quote = randomUUID(), turn = randomUUID();
    await db.query('INSERT INTO usuarios(slug) VALUES($1)', [slug]);
    await db.query('INSERT INTO equipo(id,slug) VALUES($1,$2)', [member, slug]);
    await db.query('INSERT INTO servicios(id,slug) VALUES($1,$2)', [service, slug]);
    await db.query("INSERT INTO consultas(id,consumidor_id,slug,servicio_id,titulo) VALUES($1,$2,$3,$4,'Prueba')", [thread, consumer, slug, service]);
    await db.query(`INSERT INTO consulta_presupuestos(id,consulta_id,detalle,total,sena,equipo_id,fecha,hora,duracion,vence_at)
      VALUES($1,$2,'Prueba',100,30,$3,'2027-01-01','15:00',30,'2027-01-02')`, [quote, thread, member]);
    if (booked) {
      await db.query("INSERT INTO turnos(id,slug,fecha,hora,estado,duracion_reservada,presupuesto_id) VALUES($1,$2,'2027-01-01','15:00','confirmado',30,$3)", [turn, slug, quote]);
      await db.query('UPDATE consulta_presupuestos SET turno_id=$1 WHERE id=$2', [turn, quote]);
      await db.query('INSERT INTO reprogramaciones(slug,turno_id) VALUES($1,$2)', [slug, turn]);
    }
    return { member, service, thread, quote, turn };
  }
  const blocked = await seed('broken');
  await assert.rejects(db.query("DELETE FROM usuarios WHERE slug='broken'"), /foreign key/, 'reproduce reported failure');
  await db.exec(migration('20261101194126_account_delete_quote_constraints'));
  const unrelated = await seed('keep', true);
  for (const booked of [false, true]) {
    const slug = booked ? 'booked' : 'proposal';
    const row = await seed(slug, booked);
    const path = `${row.thread}/${randomUUID()}.webp`;
    await db.query("INSERT INTO consulta_mensajes(consulta_id,autor,archivo,archivo_bytes) VALUES($1,'cliente',$2,100)", [row.thread, path]);
    await assert.rejects(db.query('DELETE FROM equipo WHERE id=$1', [row.member]), /foreign key/, 'individual member still protected');
    await assert.rejects(db.query('DELETE FROM servicios WHERE id=$1', [row.service]), /foreign key/, 'individual service still protected');
    await db.query('DELETE FROM usuarios WHERE slug=$1', [slug]);
    for (const table of ['usuarios', 'equipo', 'servicios', 'consultas', 'turnos', 'reprogramaciones']) {
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE slug=$1`, [slug])).rows[0].n, 0, table);
    }
    assert.equal((await db.query('SELECT count(*)::int AS n FROM consulta_presupuestos WHERE id=$1', [row.quote])).rows[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM consulta_mensajes WHERE consulta_id=$1', [row.thread])).rows[0].n, 0);
    assert.equal((await db.query('SELECT path FROM consulta_archivos_eliminar WHERE path=$1', [path])).rows.length, 1, 'storage cleanup queued');
  }
  await db.query("DELETE FROM usuarios WHERE slug='broken'");
  const paid = await seed('payment', true), checkout = randomUUID();
  await db.query("INSERT INTO consulta_checkouts(id,presupuesto_id,importe,vendedor_id) VALUES($1,$2,30,'test')", [checkout, paid.quote]);
  await db.query("INSERT INTO consulta_pagos(payment_id,checkout_id,importe,estado,turno_id) VALUES('test-payment',$1,30,'reintegro_pendiente',$2)", [checkout, paid.turn]);
  await assert.rejects(db.query("DELETE FROM usuarios WHERE slug='payment'"), /foreign key/, 'payments are not silently discarded');
  for (const table of ['usuarios', 'equipo', 'servicios', 'consultas', 'turnos', 'reprogramaciones']) {
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE slug='payment'`)).rows[0].n, 1, `rollback preserves ${table}`);
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM consultas WHERE id=$1', [unrelated.thread])).rows[0].n, 1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM consumidores')).rows[0].n, 1);
  await db.close();

  // Exercise the actual helper: one scoped DELETE, no Storage work on failure.
  const source = fs.readFileSync('api/server.js', 'utf8');
  const helper = source.slice(source.indexOf('async function borrarNegocioCompleto('), source.indexOf('\nconst validateEmail'));
  let fail = true, storageCalls = 0, invalidated = [];
  const calls = [];
  const context = { console, invalidateCache: slug => invalidated.push(slug), supabase: {
    from: table => ({ delete: () => ({ eq: async (column, slug) => { calls.push([table,column,slug]); return {error: fail ? {message:'blocked'} : null}; } }) }),
    storage: { from: () => ({ list: async () => { storageCalls++; return {data:[]}; } }) },
  } };
  vm.createContext(context); vm.runInContext(helper, context);
  await assert.rejects(context.borrarNegocioCompleto('fixture'), /blocked/);
  assert.equal(storageCalls, 0); assert.equal(invalidated.length, 0);
  fail = false; await context.borrarNegocioCompleto('fixture');
  assert.deepEqual(calls, [['usuarios','slug','fixture'],['usuarios','slug','fixture']]);
  assert.deepEqual(invalidated, ['fixture']);
  console.log('PASS account deletion: proposals, booked cycles, isolated businesses, file cleanup, rollback/payment protection and atomic API helper.');
})().catch(error => { console.error(error); process.exitCode = 1; });
