/** Thrown by adapters that exist only as interfaces until their backend is configured. */
export class NotImplementedError extends Error {
  override name = 'NotImplementedError';
}

export const FIRESTORE_TODO = 'Firestore adapter: wire up when Firebase is configured';
