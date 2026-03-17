const MONTHLY_RATE = 0.035;

export function calculatePMT(
  valorReforma: number,
  entradaPrevista: number,
  parcelas: number
): number {
  const pv = valorReforma - entradaPrevista;

  if (pv <= 0) return 0;
  if (parcelas <= 0) return 0;

  const rate = MONTHLY_RATE;
  const pow = Math.pow(1 + rate, parcelas);
  const pmt = (pv * rate * pow) / (pow - 1);

  return Math.round(pmt * 100) / 100;
}
