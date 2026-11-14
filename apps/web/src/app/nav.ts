import type { Permission } from '@stopwash/shared';
import {
  BarChart3,
  CalendarCheck,
  CarFront,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  ListOrdered,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  /** i18n key under `nav.` */
  key: string;
  icon: LucideIcon;
  permission: Permission;
  group: 'counter' | 'manage' | 'finance' | 'admin';
}

export const NAV: NavItem[] = [
  {
    to: '/',
    key: 'dashboard',
    icon: LayoutDashboard,
    permission: 'analytics.read',
    group: 'counter',
  },
  { to: '/pos', key: 'newOrder', icon: CarFront, permission: 'order.create', group: 'counter' },
  { to: '/queue', key: 'queue', icon: ListOrdered, permission: 'order.read', group: 'counter' },
  { to: '/shift', key: 'shift', icon: ClipboardCheck, permission: 'shift.read', group: 'counter' },
  { to: '/cash', key: 'cash', icon: Wallet, permission: 'cash.read', group: 'counter' },
  {
    to: '/approvals',
    key: 'approvals',
    icon: ShieldCheck,
    permission: 'shift.approve',
    group: 'finance',
  },
  { to: '/reports', key: 'reports', icon: BarChart3, permission: 'report.read', group: 'finance' },
  { to: '/invoices', key: 'invoices', icon: Receipt, permission: 'invoice.read', group: 'finance' },
  { to: '/staff', key: 'staff', icon: Users, permission: 'employee.read', group: 'manage' },
  {
    to: '/attendance',
    key: 'attendance',
    icon: CalendarCheck,
    permission: 'attendance.read',
    group: 'manage',
  },
  { to: '/leave', key: 'leave', icon: CalendarCheck, permission: 'leave.request', group: 'manage' },
  { to: '/payroll', key: 'payroll', icon: FileText, permission: 'payroll.read', group: 'manage' },
  { to: '/audit', key: 'audit', icon: ScrollText, permission: 'audit.read', group: 'admin' },
  {
    to: '/settings',
    key: 'settings',
    icon: Settings,
    permission: 'settings.write',
    group: 'admin',
  },
];

export const NAV_GROUPS: NavItem['group'][] = ['counter', 'finance', 'manage', 'admin'];
