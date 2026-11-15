import type { OrderLine } from '@stopwash/shared';
import type { DisplayState } from './channel';

export function orderDisplay(
  plate: string,
  lines: readonly Pick<OrderLine, 'name' | 'qty' | 'totalCents'>[],
  t: {
    subtotalCents: number;
    discountCents: number;
    loyaltyDiscountCents: number;
    totalCents: number;
  },
): DisplayState {
  return {
    kind: 'order',
    plate,
    lines: lines.map((l) => ({ name: l.name, qty: l.qty, totalCents: l.totalCents })),
    subtotalCents: t.subtotalCents,
    discountCents: t.discountCents + t.loyaltyDiscountCents,
    totalCents: t.totalCents,
  };
}
