import { subtract, sum, type Cents } from './money';
import type { CashMovementType } from './schemas/catalog';
import type { PaymentMethod } from './schemas/operations';

export interface ReconcileInput {
  openingCents: Cents;
  /** Every payment in the shift, including negative reversals (refunds). */
  payments: ReadonlyArray<{ method: PaymentMethod; amountCents: Cents }>;
  /** Every cash movement in the shift, including negative reversals. */
  cashMovements: ReadonlyArray<{ type: CashMovementType; amountCents: Cents }>;
  /** Physical drawer count. null while the count hasn't been entered. */
  countedCents: Cents | null;
  thresholds: { explainAboveCents: Cents; overrideAboveCents: Cents };
}

export type VarianceLabel = 'MATCHED' | 'SHORTAGE' | 'OVERAGE';

export interface Reconciliation {
  openingCents: Cents;
  cashSalesCents: Cents;
  cardSalesCents: Cents;
  otherSalesCents: Cents;
  totalSalesCents: Cents;
  expensesCents: Cents;
  depositsCents: Cents;
  /** opening + cash sales − expenses − deposits (SWOMS formula). */
  expectedCents: Cents;
  countedCents: Cents | null;
  /** counted − expected; negative is a shortage. */
  varianceCents: Cents | null;
  label: VarianceLabel | null;
  /** |variance| > explain threshold: a written explanation is required. */
  needsExplanation: boolean;
  /** |variance| > override threshold: a manager PIN is required to close. */
  needsOverride: boolean;
}

export function reconcile(input: ReconcileInput): Reconciliation {
  const byMethod = (m: PaymentMethod) =>
    sum(input.payments.filter((p) => p.method === m).map((p) => p.amountCents));
  const byType = (t: CashMovementType) =>
    sum(input.cashMovements.filter((c) => c.type === t).map((c) => c.amountCents));
  const cashSalesCents = byMethod('CASH');
  const cardSalesCents = byMethod('CARD');
  const otherSalesCents = sum(
    input.payments
      .filter((p) => p.method !== 'CASH' && p.method !== 'CARD')
      .map((p) => p.amountCents),
  );
  const expensesCents = byType('EXPENSE');
  const depositsCents = byType('DEPOSIT');
  const expectedCents = subtract(
    subtract(sum([input.openingCents, cashSalesCents]), expensesCents),
    depositsCents,
  );
  const varianceCents =
    input.countedCents === null ? null : subtract(input.countedCents, expectedCents);
  const abs = varianceCents === null ? 0 : Math.abs(varianceCents);
  return {
    openingCents: input.openingCents,
    cashSalesCents,
    cardSalesCents,
    otherSalesCents,
    totalSalesCents: sum([cashSalesCents, cardSalesCents, otherSalesCents]),
    expensesCents,
    depositsCents,
    expectedCents,
    countedCents: input.countedCents,
    varianceCents,
    label:
      varianceCents === null
        ? null
        : varianceCents === 0
          ? 'MATCHED'
          : varianceCents < 0
            ? 'SHORTAGE'
            : 'OVERAGE',
    needsExplanation: abs > input.thresholds.explainAboveCents,
    needsOverride: abs > input.thresholds.overrideAboveCents,
  };
}
