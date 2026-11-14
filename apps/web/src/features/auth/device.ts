/**
 * Registered-device credentials. A manager enters these once per tablet/phone; they let the
 * device show the staff PIN pad. They live in localStorage on this device only.
 */
export interface DeviceCredentials {
  deviceId: string;
  deviceSecret: string;
}

const KEY = 'sw:device';

export function loadDevice(): DeviceCredentials | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<DeviceCredentials>;
    return v.deviceId && v.deviceSecret
      ? { deviceId: v.deviceId, deviceSecret: v.deviceSecret }
      : null;
  } catch {
    return null;
  }
}

export function saveDevice(d: DeviceCredentials | null): void {
  try {
    if (d) window.localStorage.setItem(KEY, JSON.stringify(d));
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage blocked: the device must be registered again next time
  }
}
