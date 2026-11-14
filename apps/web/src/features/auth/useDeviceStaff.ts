import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { loadDevice } from './device';

export interface DeviceStaff {
  id: string;
  name: string;
  code: string;
  jobTitle: string;
  initials: string;
  role: string | null;
  canOpenShift: boolean;
}

/** Staff who can sign in on this device (used for supervisor and approver pickers). */
export function useDeviceStaff(enabled = true) {
  return useQuery({
    queryKey: ['device-staff-list'],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const device = loadDevice();
      if (!device) return [] as DeviceStaff[];
      return (await api<{ staff: DeviceStaff[] }>('/auth/device/staff', { body: device })).staff;
    },
  });
}

export const isManager = (s: DeviceStaff) => s.role === 'manager' || s.role === 'owner';
