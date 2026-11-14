import { multiply, sum, type Cents } from './money';
import type { DenominationCountValue } from './schemas/operations';

/** Total of a drawer count: Σ note value × count + coins (entered as a value, like SWOMS). */
export function denominationTotal(
  denominations: readonly Cents[],
  count: DenominationCountValue,
): Cents {
  const unknown = Object.keys(count.notes).filter((k) => !denominations.includes(Number(k)));
  if (unknown.some((k) => (count.notes[k] ?? 0) > 0)) {
    throw new RangeError(`Unknown denomination(s): ${unknown.join(', ')}`);
  }
  return sum([
    ...denominations.map((d) => multiply(d, count.notes[String(d)] ?? 0)),
    count.coinsCents,
  ]);
}

export const emptyCount = (): DenominationCountValue => ({ notes: {}, coinsCents: 0 });
