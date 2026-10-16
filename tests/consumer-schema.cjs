const assert = require("node:assert/strict");
const fs = require("node:fs");
// npm install --no-save @electric-sql/pglite, or provide PGLITE_MODULE.
const { PGlite } = require(process.env.PGLITE_MODULE || "@electric-sql/pglite");
(async () => {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE usuarios(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
 CREATE TABLE equipo(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), login_email text);
 CREATE TABLE admins(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
 CREATE TABLE registros_pendientes(email text PRIMARY KEY);
 INSERT INTO usuarios(email) VALUES ('owner@test.example');`);
  const sql = fs.readFileSync(
    "supabase/migrations/20261016_registro_consumidores.sql",
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM usuarios")).rows[0].n,
    1,
  );
  const insertPending = async (email) =>
    (
      await db.query(
        `INSERT INTO registros_consumidores(email,nombre_persona,apellido,telefono,password_hash,intereses,codigo_hash,codigo_expiry) VALUES ($1,'Ana','Test','3515555555','hash',ARRAY['barberia','vehiculos'],'correct',now()+interval '15 minutes') RETURNING registro_id`,
        [email],
      )
    ).rows[0].registro_id;
  const verify = async (email, id, code) =>
    (
      await db.query(
        "SELECT verificar_registro_consumidor($1,$2,$3) AS result",
        [email, id, code],
      )
    ).rows[0].result;
  let id = await insertPending("user@test.example");
  assert.equal(
    (await verify("user@test.example", null, "correct")).success,
    false,
  );
  assert.equal((await verify("user@test.example", id, null)).success, false);
  for (let i = 0; i < 4; i++)
    assert.equal(
      (await verify("user@test.example", id, "wrong")).code,
      "codigo_incorrecto",
    );
  assert.equal(
    (await verify("user@test.example", id, "correct")).code,
    "codigo_expirado",
  );
  await db.query(
    `UPDATE registros_consumidores SET intentos=0 WHERE email=$1`,
    ["user@test.example"],
  );
  const result = await verify("user@test.example", id, "correct");
  assert.equal(result.success, true);
  assert.equal(result.password, undefined);
  assert.equal(
    (await verify("user@test.example", id, "correct")).success,
    false,
  );
  const expiredId = await insertPending("expired@test.example");
  await db.query(
    `UPDATE registros_consumidores SET codigo_expiry=now()-interval '1 second' WHERE email='expired@test.example'`,
  );
  assert.equal(
    (await verify("expired@test.example", expiredId, "correct")).code,
    "codigo_expirado",
  );
  await assert.rejects(
    db.query(`INSERT INTO usuarios(email) VALUES ('user@test.example')`),
    /Ya existe/,
  );
  id = await insertPending("owner@test.example");
  await assert.rejects(
    verify("owner@test.example", id, "correct"),
    /Ya existe/,
  );
  assert.equal(
    (
      await db.query(
        `SELECT count(*)::int AS n FROM registros_consumidores WHERE email='owner@test.example'`,
      )
    ).rows[0].n,
    1,
  );
  await db.exec(`SET ROLE anon;`);
  await assert.rejects(
    db.query("SELECT * FROM consumidores"),
    /permission denied/,
  );
  await assert.rejects(
    verify("user@test.example", id, "correct"),
    /permission denied/,
  );
  await db.exec(`RESET ROLE;`);
  await db.query(
    `INSERT INTO google_login_accounts(google_sub,consumidor_id) VALUES ('google-user',$1)`,
    [result.id],
  );
  await assert.rejects(
    db.query(
      `INSERT INTO google_login_accounts(google_sub) VALUES ('invalid')`,
    ),
    /check constraint/,
  );
  await db.close();
  console.log(
    "Consumer SQL: idempotence, preserved owners, OTP limits/null/replay, email isolation, Google binding and grants PASS",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
