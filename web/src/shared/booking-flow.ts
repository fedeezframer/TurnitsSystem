export const BOOKING_STEP_ORDER = ["sucursal", "profesional", "servicio", "fecha", "hora", "checkout"];

export function bookingSteps(options: {
  offer: boolean;
  branchCount: number;
  branchPinned: boolean;
  professionalCount: number;
  professionalPinned: boolean;
  serviceResolved: boolean;
}) {
  if (options.offer) return ["checkout"];
  return BOOKING_STEP_ORDER.filter(step =>
    step === "sucursal" ? options.branchCount > 1 && !options.branchPinned :
    step === "profesional" ? options.professionalCount > 1 && !options.professionalPinned :
    step === "servicio" ? !options.serviceResolved : true
  );
}

// A step can disappear when its only option finishes loading. Continue forwards
// instead of restarting at the branch picker, including after back navigation.
export function resolveBookingStep(current: string, steps: string[]) {
  if (steps.includes(current)) return current;
  return steps.find(step => BOOKING_STEP_ORDER.indexOf(step) >= BOOKING_STEP_ORDER.indexOf(current)) || steps.at(-1) || "";
}
