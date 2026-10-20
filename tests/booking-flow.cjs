const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('../web/node_modules/typescript');
const compiled=ts.transpileModule(fs.readFileSync('web/src/shared/booking-flow.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const context={exports:{}};vm.runInNewContext(compiled,context);
const {bookingSteps,resolveBookingStep}=context.exports;
const base={offer:false,branchCount:2,branchPinned:false,professionalCount:3,professionalPinned:false,serviceResolved:false};
function check(options,expected){assert.deepEqual(Array.from(bookingSteps({...base,...options})),expected)}
check({},['sucursal','profesional','servicio','fecha','hora','checkout']);
check({branchCount:1},['profesional','servicio','fecha','hora','checkout']);
check({branchCount:0,professionalCount:0,serviceResolved:true},['fecha','hora','checkout']);
check({branchCount:1,professionalCount:1,serviceResolved:true},['fecha','hora','checkout']);
check({branchPinned:true,serviceResolved:true},['profesional','fecha','hora','checkout']);
check({branchPinned:true,professionalPinned:true,serviceResolved:true},['fecha','hora','checkout']);
check({offer:true},['checkout']);
assert.equal(resolveBookingStep('servicio',['sucursal','profesional','fecha','hora','checkout']),'fecha');
assert.equal(resolveBookingStep('profesional',['sucursal','servicio','fecha','hora','checkout']),'servicio');
assert.equal(resolveBookingStep('',['profesional','fecha','hora','checkout']),'profesional');
assert.equal(resolveBookingStep('checkout',['fecha','hora','checkout']),'checkout');
console.log('PASS adaptive booking steps: normal, single branch/member/service, pinned context, Offer, forward resolution and back navigation.');
