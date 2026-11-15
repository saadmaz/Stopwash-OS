import { expect, test, type Page } from '@playwright/test';

/** Dev seed (in-memory API): device + staff PINs. */
const DEVICE = { id: 'dev-counter', secret: 'dev-counter-secret-change-me' };
const CASHIER = { name: 'Kasun Perera', pin: '4826' };
const ACCOUNTS = { name: 'Ruwan Silva', pin: '5038' };

async function registerDevice(page: Page) {
  await page.goto('/');
  const id = page.getByLabel('Device ID');
  if (await id.isVisible().catch(() => false)) {
    await id.fill(DEVICE.id);
    await page.getByLabel('Device secret').fill(DEVICE.secret);
    await page.getByRole('button', { name: 'Save device' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Who is signing in?' })).toBeVisible();
}

async function signIn(page: Page, who: { name: string; pin: string }) {
  await page.getByRole('button', { name: who.name }).click();
  await page.keyboard.type(who.pin);
  await expect(page.getByRole('banner').getByText(who.name)).toBeVisible();
}

test('a full shift: open, sell, pay, close, approve', async ({ page }) => {
  await registerDevice(page);
  await signIn(page, CASHIER);
  await expect(page.getByRole('heading', { name: 'New order' })).toBeVisible();
  await page.goto('/shift');
  await page.getByRole('button', { name: 'Save & Next' }).click();
  await page.getByLabel('Number of LKR 1,000 notes').fill('5');
  await page.getByRole('combobox', { name: 'Supervisor' }).click();
  await page.getByRole('option', { name: CASHIER.name }).click();
  await page.getByRole('button', { name: 'Start shift · LKR 5,000.00' }).click();
  await expect(page.getByText('Shift started with LKR 5,000.00')).toBeVisible();

  await page.goto('/pos');
  await page.getByLabel('Vehicle plate').fill('CAB-1234');
  await page.getByRole('radio', { name: 'Small (Car)' }).click();
  await page.getByRole('button', { name: 'Add order' }).click();
  await expect(page.getByText(/added to the queue/)).toBeVisible();

  await page.goto('/queue');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('In bay')).toBeVisible();
  await page.getByRole('button', { name: 'Take payment' }).click();
  const pay = page.getByRole('dialog', { name: 'Payment · CAB-1234' });
  await pay.getByLabel('Cash received').fill('1000');
  await expect(pay.getByText('Change: LKR 250.00')).toBeVisible();
  await pay.getByRole('button', { name: 'Take LKR 750.00' }).click();
  await expect(page.getByText(/Paid · receipt/).first()).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/shift');
  await page.getByRole('button', { name: 'End Shift' }).click();
  const close = page.getByRole('dialog', { name: 'End Shift' });
  await expect(close.getByText('LKR 5,750.00')).toBeVisible();
  await close.getByLabel('Number of LKR 1,000 notes').fill('5');
  await close.getByLabel('Number of LKR 500 notes').fill('1');
  await close.getByLabel('Number of LKR 100 notes').fill('2');
  await close.getByLabel('Number of LKR 50 notes').fill('1');
  await expect(close.getByText('Matched')).toBeVisible();
  await close.getByRole('combobox', { name: 'Incoming supervisor' }).click();
  await page.getByRole('option', { name: 'Dilani Fernando' }).click();
  await close.getByLabel('Their PIN').fill('7391');
  await close.getByRole('button', { name: 'Close & sign off' }).click();
  await expect(page.getByText('Shift closed and signed off').first()).toBeVisible();

  // Accounts approves the closed shift.
  await page.getByRole('main').getByRole('button', { name: 'Switch user' }).click();
  await signIn(page, ACCOUNTS);
  await page.goto('/approvals');
  const row = page.getByRole('row', { name: /Kasun Perera/ });
  await expect(row.getByRole('cell', { name: 'LKR 750.00' })).toBeVisible();
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Shift approved').first()).toBeVisible();
  await page.getByRole('radio', { name: 'Approved' }).click();
  await expect(page.getByRole('row', { name: /Kasun Perera/ }).getByText('Approved')).toBeVisible();
});
