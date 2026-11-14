import { whatsappLink } from './normalize';

/** Timestamp in the SWOMS alert style: "Nov 15, 2026, 9:15 AM" (Asia/Colombo). */
export function alertTimestamp(iso: string, tz = 'Asia/Colombo'): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/** Same wording as the old app's low-stock / stock-request WhatsApp messages. */
export function stockAlertMessage(
  lowItems: readonly string[],
  at: string,
  mode: 'PRE_SHIFT' | 'REQUEST',
  requestedBy?: string,
): string {
  const header =
    mode === 'REQUEST'
      ? `*STOCK REQUEST - ${alertTimestamp(at)}*`
      : `*LOW STOCK ALERT - ${alertTimestamp(at)}*`;
  const footer =
    mode === 'REQUEST'
      ? `Requested by staff: ${requestedBy ?? 'N/A'}`
      : 'Please arrange for restocking.';
  return `${header}\n${lowItems.map((i) => `• ${i}`).join('\n')}\n\n${footer}`;
}

export function equipmentAlertMessage(faulty: readonly string[], at: string): string {
  return (
    `*⚠️ EQUIPMENT FAILURE ALERT - ${alertTimestamp(at)}*\n\n` +
    `The following equipment has been marked as *FAULTY* during the daily check:\n` +
    `${faulty.map((i) => `❌ ${i}`).join('\n')}\n\n` +
    'Please arrange for urgent repairs.'
  );
}

export function varianceAlertMessage(
  shiftLabel: string,
  varianceText: string,
  at: string,
  note: string | null,
): string {
  return (
    `*CASH VARIANCE - ${alertTimestamp(at)}*\n` +
    `Shift: ${shiftLabel}\nVariance: ${varianceText}` +
    (note ? `\nExplanation: ${note}` : '')
  );
}

export interface WhatsappAlert {
  kind: 'stock' | 'equipment' | 'variance';
  phone: string;
  url: string;
}

export function whatsappAlerts(
  kind: WhatsappAlert['kind'],
  phones: readonly string[],
  text: string,
): WhatsappAlert[] {
  return phones.map((phone) => ({ kind, phone, url: whatsappLink(phone, text) }));
}
