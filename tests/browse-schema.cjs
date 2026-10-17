const { PGlite } = require(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE usuarios(slug text PRIMARY KEY,activo boolean DEFAULT true,estado_suscripcion text,fecha_vencimiento timestamptz);
 CREATE TABLE consumidores(id uuid PRIMARY KEY,nombre_persona text,apellido text,telefono text,email text UNIQUE,activo boolean DEFAULT true,email_verificado boolean DEFAULT true);
 CREATE TABLE equipo(id uuid PRIMARY KEY,slug text REFERENCES usuarios(slug),nombre text,apellido text,"es_dueño" boolean DEFAULT false,activo boolean DEFAULT true);
 CREATE TABLE servicios(id uuid PRIMARY KEY,slug text REFERENCES usuarios(slug),nombre text,precio numeric,duracion integer DEFAULT 30,activo boolean DEFAULT true,owner_equipo_id uuid);
 CREATE TABLE servicio_equipo(servicio_id uuid,equipo_id uuid,precio_override numeric);
 CREATE TABLE extras(id uuid PRIMARY KEY,slug text,nombre text,activo boolean DEFAULT true,owner_equipo_id uuid);
 CREATE TABLE turnos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text,nombre text,apellido text,telefono text,email text,fecha date,hora time,servicio_id uuid,servicio_nombre text,equipo_id uuid,equipo_nombre text,precio_cobrado numeric,monto_pagado numeric,extras jsonb,monto_extras numeric,estado text,metodo_pago text,pago_estado text,duracion_reservada integer);
 CREATE TABLE pagos_pendientes(id uuid PRIMARY KEY);`);
    const sql = fs.readFileSync(
      "supabase/migrations/20261017_browse.sql",
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    const ids = Array.from({ length: 8 }, () => crypto.randomUUID()),
      [c, c2, e, e2, s, r, o, p] = ids;
    await db.query("INSERT INTO usuarios(slug) VALUES ('shop')");
    for (const id of [c, c2])
      await db.query(
        "INSERT INTO consumidores(id,nombre_persona,apellido,telefono,email) VALUES($1,'Ana','Test','543515555555',$2)",
        [id, id + "@test.example"],
      );
    for (const [id, owner] of [
      [e, true],
      [e2, false],
    ])
      await db.query(
        "INSERT INTO equipo(id,slug,nombre,\"es_dueño\") VALUES($1,'shop','Ana',$2)",
        [id, owner],
      );
    await db.query(
      "INSERT INTO servicios(id,slug,nombre,precio) VALUES($1,'shop','Corte',15000)",
      [s],
    );
    for (const team of [e, e2])
      await db.query(
        "INSERT INTO servicio_equipo(servicio_id,equipo_id) VALUES($1,$2)",
        [s, team],
      );
    await db.query(
      "INSERT INTO turnits_offers(id,slug,servicio_id,equipo_id,precio_minimo,activo) VALUES($1,'shop',$2,$3,10000,true)",
      [o, s, e],
    );
    await db.query(
      "INSERT INTO turnits_recompensas(id,slug,nombre,tipo,objeto_id,servicio_id,monedas,stock,activo) VALUES($1,'shop','Corte gratis','servicio',$2,$2,3,1,true)",
      [r, s],
    );
    const credit = async (amount) => {
      const q = await db.query(
        "INSERT INTO turnos(slug,consumidor_id,fecha,hora,estado,metodo_pago,pago_estado,monto_pagado,tc_elegible) VALUES('shop',$1,current_date-1,'08:00','confirmado','mercadopago','aprobado',$2,true) RETURNING id",
        [c, amount],
      );
      return q.rows[0].id;
    };
    await credit(25000);
    const small = await credit(5000);
    assert.equal(
      (
        await db.query(
          "SELECT saldo FROM tc_billeteras WHERE consumidor_id=$1",
          [c],
        )
      ).rows[0].saldo,
      3,
    );
    await db.query("UPDATE turnos SET monto_pagado=5000 WHERE id=$1", [small]);
    assert.equal(
      (
        await db.query(
          "SELECT saldo FROM tc_billeteras WHERE consumidor_id=$1",
          [c],
        )
      ).rows[0].saldo,
      3,
    );
    const date = (
      await db.query(
        "SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'+interval '1 day')::date::text AS d",
      )
    ).rows[0].d;
    const redeem = async (who) =>
      (
        await db.query(
          "SELECT * FROM browse_reservar($1,'shop',$2,$3,$4,'15:00',$5,NULL,0)",
          [who, s, e, date, r],
        )
      ).rows[0];
    const t = await redeem(c);
    assert.equal(t.precio_cobrado, "0.00");
    assert.equal(t.metodo_pago, "none");
    assert.equal(
      (
        await db.query(
          "SELECT saldo FROM tc_billeteras WHERE consumidor_id=$1",
          [c],
        )
      ).rows[0].saldo,
      0,
    );
    await assert.rejects(redeem(c), /disponible|suficientes/);
    await assert.rejects(redeem(c2), /disponible|suficientes/);
    await db.query("UPDATE turnos SET estado='cancelado' WHERE id=$1", [t.id]);
    assert.equal(
      (
        await db.query(
          "SELECT saldo FROM tc_billeteras WHERE consumidor_id=$1",
          [c],
        )
      ).rows[0].saldo,
      3,
    );
    await db.query("UPDATE turnos SET estado='cancelado' WHERE id=$1", [t.id]);
    assert.equal(
      (
        await db.query(
          "SELECT saldo FROM tc_billeteras WHERE consumidor_id=$1",
          [c],
        )
      ).rows[0].saldo,
      3,
    );
    await assert.rejects(
      db.query("UPDATE turnos SET estado='confirmado' WHERE id=$1", [t.id]),
      /reservarse de nuevo/,
    );
    const slot = (
      await db.query(
        "SELECT to_char((now()+interval '20 minutes') AT TIME ZONE 'America/Argentina/Buenos_Aires','YYYY-MM-DD HH24:MI') AS start",
      )
    ).rows[0].start;
    const when = slot.replace(" ", "T"),
      day = when.slice(0, 10),
      time = when.slice(11, 16),
      close = new Date(day + "T" + time + ":00-03:00").toISOString();
    const offer = async (who) =>
      (
        await db.query(
          "SELECT * FROM browse_reservar($1,'shop',$2,$3,$4,$5,NULL,$6,10000,$7)",
          [who, s, e, day, time, o, close],
        )
      ).rows[0];
    // The clock is 20 minutes from the cutoff: 60% of the maximum discount.
    await assert.rejects(offer(c), /precio cambió/);
    const held = (
      await db.query(
        "SELECT * FROM browse_reservar($1,'shop',$2,$3,$4,$5,NULL,$6,12000,$7)",
        [c, s, e, day, time, o, close],
      )
    ).rows[0];
    await assert.rejects(
      db.query(
        "INSERT INTO turnos(slug,fecha,hora,equipo_id,servicio_id,estado) VALUES('shop',$1,$2,$3,$4,'confirmado')",
        [day, time, e, s],
      ),
      /ya fue reservado/,
    );
    await assert.rejects(
      db.query(
        "SELECT browse_reservar($1,'shop',$2,$3,$4,$5,NULL,$6,12000,$7)",
        [c2, s, e, day, time, o, close],
      ),
      /ya fue reservado/,
    );
    await db.query(
      "INSERT INTO turnos(slug,fecha,hora,equipo_id,servicio_id,estado) VALUES('shop',$1,$2,$3,$4,'confirmado')",
      [day, time, e2, s],
    );
    await db.query(
      "UPDATE turnos SET estado='confirmado',pago_estado='aprobado',monto_pagado=12000 WHERE id=$1",
      [held.id],
    );
    assert.equal(
      (
        await db.query(
          "SELECT saldo FROM tc_billeteras WHERE consumidor_id=$1",
          [c],
        )
      ).rows[0].saldo,
      4,
    );
    await db.query("UPDATE turnos SET pago_estado='reembolsado' WHERE id=$1", [
      held.id,
    ]);
    assert.equal(
      (
        await db.query(
          "SELECT saldo FROM tc_billeteras WHERE consumidor_id=$1",
          [c],
        )
      ).rows[0].saldo,
      3,
    );
    // A product can only be redeemed while booking its required service;
    // the cash portion follows the selected professional's current tariff.
    const productReward = crypto.randomUUID(),
      product = crypto.randomUUID();
    await db.query(
      "INSERT INTO extras(id,slug,nombre) VALUES($1,'shop','Producto')",
      [product],
    );
    await db.query(
      "UPDATE servicio_equipo SET precio_override=18000 WHERE servicio_id=$1 AND equipo_id=$2",
      [s, e2],
    );
    await db.query(
      "INSERT INTO turnits_recompensas(id,slug,nombre,tipo,objeto_id,servicio_id,monedas,stock,activo) VALUES($1,'shop','Producto con corte','producto',$2,$3,1,1,true)",
      [productReward, product, s],
    );
    const productArgs = [c, s, e2, date, productReward];
    await assert.rejects(
      db.query(
        "SELECT * FROM browse_reservar($1,'shop',$2,$3,$4,'17:00',$5,NULL,15000)",
        productArgs,
      ),
      /importe adicional cambió/,
    );
    const productBooking = (
      await db.query(
        "SELECT * FROM browse_reservar($1,'shop',$2,$3,$4,'17:00',$5,NULL,18000)",
        productArgs,
      )
    ).rows[0];
    assert.equal(Number(productBooking.precio_cobrado), 18000);
    assert.equal(productBooking.extras[0].precio, 0);
    assert.equal(
      (
        await db.query(
          "SELECT saldo FROM tc_billeteras WHERE consumidor_id=$1",
          [c],
        )
      ).rows[0].saldo,
      2,
    );
    await db.query("DELETE FROM turnos WHERE id=$1", [productBooking.id]);
    assert.equal(
      (
        await db.query(
          "SELECT saldo FROM tc_billeteras WHERE consumidor_id=$1",
          [c],
        )
      ).rows[0].saldo,
      3,
    );
    assert.equal(
      (
        await db.query("SELECT stock FROM turnits_recompensas WHERE id=$1", [
          productReward,
        ])
      ).rows[0].stock,
      1,
    );
    const reward = (
      await db.query(
        "SELECT *,updated_at::text AS expected_updated_at FROM turnits_recompensas WHERE id=$1",
        [r],
      )
    ).rows[0];
    await db.query("SELECT browse_guardar_config('shop',$1,$2)", [
      JSON.stringify([
        {
          id: o,
          servicio_id: s,
          equipo_id: e,
          precio_minimo: 10000,
          activo: true,
        },
      ]),
      JSON.stringify([reward]),
    ]);
    await assert.rejects(
      db.query("SELECT browse_guardar_config('shop',$1,$2)", [
        JSON.stringify([]),
        JSON.stringify([reward]),
      ]),
      /stock o la recompensa cambió/,
    );
    await db.query(
      "INSERT INTO browse_cambios_email(consumidor_id,email,codigo_hash,vence) VALUES($1,'new@test.example','good',now()+interval '15 minutes')",
      [c],
    );
    assert.equal(
      (await db.query("SELECT browse_cambiar_email($1,$2) AS ok", [c, "wrong"]))
        .rows[0].ok,
      false,
    );
    assert.equal(
      (await db.query("SELECT browse_cambiar_email($1,$2) AS ok", [c, "good"]))
        .rows[0].ok,
      true,
    );
    assert.equal(
      (await db.query("SELECT email FROM consumidores WHERE id=$1", [c]))
        .rows[0].email,
      "new@test.example",
    );
    assert.equal(
      (await db.query("SELECT browse_cambiar_email($1,$2) AS ok", [c, "good"]))
        .rows[0].ok,
      false,
    );
    await db.exec("SET ROLE anon");
    await assert.rejects(
      db.query("SELECT * FROM tc_billeteras"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("SELECT browse_guardar_config('shop','[]','[]')"),
      /permission denied/,
    );
    await db.exec("RESET ROLE");
    console.log(
      "Browse SQL: idempotence, accumulated actual spend, duplicate credit, atomic balance/stock, cancel refund once, slot exclusivity across booking methods, team isolation, payment reversal and RLS PASS",
    );
  } finally {
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
