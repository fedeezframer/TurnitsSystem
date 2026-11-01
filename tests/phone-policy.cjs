const assert = require('node:assert/strict');
(async () => {
  const { validNationalPhone: national, validInternationalPhone: international, parsePhoneInput: parse, phoneLimit } = await import('../web/src/shared/phone-policy.js');
  for (const value of ['3515551234', '1155551234', '2215551234', '93515551234']) assert.equal(national(value, 'AR'), true, value);
  for (const value of ['', '5551234', '03515551234', '1535551234', '5515551234', '35155512345', '351555123456789', 'letters']) assert.equal(national(value, 'AR'), false, value);
  assert.equal(phoneLimit('AR', '351'), 10); assert.equal(phoneLimit('AR', '9351'), 11);
  assert.deepEqual(parse('+54 (351) 555-1234', 'US'), {code:'AR', digits:'3515551234', tooLong:false});
  assert.deepEqual(parse('0054 9 351 5551234', 'UY'), {code:'AR', digits:'93515551234', tooLong:false});
  assert.equal(parse('3515551234567', 'AR').tooLong, true);
  for (const value of ['543515551234', '+5493515551234', '+59899123456', '+56912345678', '+5511999999999', '+12025550123', '+34612345678']) assert.equal(international(value), true, value);
  for (const value of ['+543515551234567', '+5403515551234', '+541555551234', '+59899123456789', '+120255501234', '+1234567890123456', '+54hello', '', null]) assert.equal(international(value), false, String(value));
  console.log('PASS phone policy: area and country lengths, international mobile prefix, formatting, paste detection and overlong rejection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
