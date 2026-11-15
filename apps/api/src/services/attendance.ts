import { AttendanceStatus, DateKeyField, type Attendance } from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';

export const MarkAttendanceInput = z.object({
  date: DateKeyField,
  entries: z
    .array(
      z.object({
        employeeId: z.string().min(1),
        status: AttendanceStatus,
        note: z.string().trim().max(200).nullish(),
      }),
    )
    .min(1)
    .max(200),
});

export interface RosterRow {
  employeeId: string;
  name: string;
  code: string;
  jobTitle: string;
  status: Attendance['status'] | null;
  note: string | null;
}

/** Everyone active at the location, with the day's status (null = not marked yet). */
export async function roster(repos: Repositories, ctx: Ctx, locationId: string, date: string) {
  const brand = eq<{ brandId: string }>('brandId', ctx.actor.brandId);
  const [employees, marks] = await Promise.all([
    repos.employees.find({
      where: [
        brand,
        eq('active', true),
        { field: 'locationIds', op: 'array-contains', value: locationId },
      ],
      orderBy: { field: 'name' },
    }),
    repos.attendance.find({ where: [brand, eq('date', date)] }),
  ]);
  const byEmployee = new Map(marks.map((m) => [m.employeeId, m]));
  return employees.map<RosterRow>((e) => ({
    employeeId: e.id,
    name: e.name,
    code: e.code,
    jobTitle: e.jobTitle,
    status: byEmployee.get(e.id)?.status ?? null,
    note: byEmployee.get(e.id)?.note ?? null,
  }));
}

/** Saves the day's marks. Approved leave days stay as LEAVE unless explicitly changed. */
export async function markAttendance(
  tx: Repositories,
  ctx: Ctx,
  locationId: string,
  input: z.infer<typeof MarkAttendanceInput>,
): Promise<number> {
  const at = ctx.now.toISOString();
  let saved = 0;
  for (const entry of input.entries) {
    const employee = await tx.employees.get(entry.employeeId);
    if (!employee || employee.brandId !== ctx.actor.brandId) {
      throw new AppError('VALIDATION_FAILED', `Unknown employee ${entry.employeeId}`);
    }
    const id = `${entry.employeeId}__${input.date}`;
    const before = await tx.attendance.get(id);
    if (before?.status === entry.status && (before.note ?? null) === (entry.note ?? null)) continue;
    await tx.attendance.upsert({
      id,
      brandId: ctx.actor.brandId,
      locationId,
      createdAt: before?.createdAt ?? at,
      createdBy: before?.createdBy ?? ctx.actor.id,
      updatedAt: at,
      updatedBy: ctx.actor.id,
      employeeId: entry.employeeId,
      date: input.date,
      status: entry.status,
      clockInAt: before?.clockInAt ?? null,
      clockOutAt: before?.clockOutAt ?? null,
      note: entry.note ?? null,
    });
    saved++;
  }
  if (saved) {
    await audit(tx, ctx, {
      action: 'attendance.mark',
      entity: 'attendance',
      entityId: input.date,
      locationId,
      after: input.entries,
    });
  }
  return saved;
}

export async function attendanceReport(
  repos: Pick<Repositories, 'attendance'>,
  brandId: string,
  from: string,
  to: string,
) {
  return repos.attendance.find({
    where: [
      eq('brandId', brandId),
      { field: 'date', op: '>=', value: from },
      { field: 'date', op: '<=', value: to },
    ],
    orderBy: { field: 'date' },
  });
}
