import {
  DEFAULT_SETTINGS,
  type CashCategory,
  type CatalogItem,
  type ChecklistItem,
  type LocalizedText,
} from '@stopwash/shared';
import { eq, type Repositories } from '../repos';

/**
 * First-run configuration, reproducing SWOMS 2.5 (see PARITY.md O2–O4, S1–S2, C3).
 * Everything here is editable afterwards from Settings.
 */
const CATALOG: Array<[CatalogItem['kind'], string, LocalizedText, number, number, string]> = [
  ['vehicleClass', 'BIKE', { en: 'Bike', si: 'බයිසිකලය', ta: 'பைக்' }, 50_000, 1, 'bike'],
  [
    'vehicleClass',
    'SMALL',
    { en: 'Small (Car)', si: 'කුඩා (කාර්)', ta: 'சிறிய (கார்)' },
    75_000,
    1,
    'car',
  ],
  [
    'vehicleClass',
    'MEDIUM',
    { en: 'Medium (SUV)', si: 'මධ්‍යම (SUV)', ta: 'நடுத்தர (SUV)' },
    100_000,
    1,
    'suv',
  ],
  [
    'vehicleClass',
    'LARGE',
    { en: 'Large (Van)', si: 'විශාල (වෑන්)', ta: 'பெரிய (வேன்)' },
    125_000,
    1,
    'van',
  ],
  ['addon', 'WAX', { en: 'Wax', si: 'ඉටි ආලේපනය', ta: 'மெழுகு' }, 25_000, 1, 'sparkles'],
  [
    'addon',
    'VACUUM_ADDON',
    { en: 'Vacuum (add-on)', si: 'රික්තක (අමතර)', ta: 'வெற்றிடம் (கூடுதல்)' },
    25_000,
    1,
    'wind',
  ],
  [
    'product',
    'AIR_FRESHENER',
    { en: 'Air freshener', si: 'වායු සුවඳ', ta: 'காற்று நறுமணம்' },
    50_000,
    10,
    'spray',
  ],
  [
    'product',
    'VACUUM_PRODUCT',
    { en: 'Interior vacuum', si: 'අභ්‍යන්තර රික්තක', ta: 'உள் வெற்றிடம்' },
    50_000,
    5,
    'wind',
  ],
  [
    'product',
    'WIPER_FLUID',
    { en: 'Wiper fluid', si: 'වයිපර් දියර', ta: 'வைப்பர் திரவம்' },
    25_000,
    10,
    'droplet',
  ],
];

const ok = { en: 'Have stock', si: 'තොග ඇත', ta: 'இருப்பு உள்ளது' };
const low = { en: 'Running low', si: 'අඩුවෙමින්', ta: 'குறைவாக உள்ளது' };
const CHECKLIST: Array<[ChecklistItem['kind'], LocalizedText, LocalizedText, LocalizedText]> = [
  ['stock', { en: 'Shampoo', si: 'ෂැම්පු', ta: 'ஷாம்பு' }, ok, low],
  ['stock', { en: 'Tyre shine', si: 'ටයර් දීප්තිය', ta: 'டயர் பளபளப்பு' }, ok, low],
  ['stock', { en: 'Glass cleaner', si: 'වීදුරු පිරිසිදු කාරකය', ta: 'கண்ணாடி சுத்திகரிப்பான்' }, ok, low],
  ['stock', { en: 'Air freshener', si: 'වායු සුවඳ', ta: 'காற்று நறுமணம்' }, ok, low],
  ['stock', { en: 'Wiper fluid', si: 'වයිපර් දියර', ta: 'வைப்பர் திரவம்' }, ok, low],
  ['equipment', { en: 'Vacuum cleaner' }, { en: 'Working' }, { en: 'Faulty' }],
  ['equipment', { en: 'Pressure gun' }, { en: 'Working' }, { en: 'Faulty' }],
  ['equipment', { en: 'Mitts & cloths' }, { en: 'Clean' }, { en: 'Need wash' }],
  ['equipment', { en: 'Power & water' }, { en: 'Stable' }, { en: 'Issues' }],
];

const CASH: Array<[CashCategory['type'], string, string]> = [
  ['EXPENSE', 'E001', 'Cleaning supplies'],
  ['EXPENSE', 'E002', 'Equipment repairs'],
  ['EXPENSE', 'E003', 'Utility top-up'],
  ['EXPENSE', 'E004', 'Staff meals'],
  ['EXPENSE', 'E005', 'Transport / delivery'],
  ['EXPENSE', 'E006', 'Minor site fixes'],
  ['EXPENSE', 'E007', 'Miscellaneous'],
  ['DEPOSIT', 'D001', 'Bank deposit'],
  ['DEPOSIT', 'D002', 'Owner withdrawal'],
  ['DEPOSIT', 'D003', 'Safe drop'],
];

export const settingsId = (brandId: string, locationId: string) => `${brandId}__${locationId}`;

/** Inserts defaults that don't exist yet. Safe to run more than once. */
export async function ensureDefaults(
  repos: Pick<Repositories, 'settings' | 'catalog' | 'checklistItems' | 'cashCategories'>,
  brandId: string,
  locationId: string,
  now: Date,
  actorId = 'system',
): Promise<void> {
  const at = now.toISOString();
  const base = { brandId, createdAt: at, createdBy: actorId, updatedAt: null, updatedBy: null };
  const sid = settingsId(brandId, locationId);
  if (!(await repos.settings.get(sid))) {
    await repos.settings.insert({
      id: sid,
      brandId,
      locationId,
      settings: DEFAULT_SETTINGS,
      updatedAt: at,
      updatedBy: actorId,
    });
  }
  if ((await repos.catalog.count({ where: [eq('brandId', brandId)] })) === 0) {
    for (const [i, [kind, code, name, priceCents, maxQty, icon]] of CATALOG.entries()) {
      await repos.catalog.insert({
        ...base,
        id: `${brandId}__${code.toLowerCase()}`,
        kind,
        code,
        name,
        description: null,
        priceCents,
        maxQty,
        locationIds: null,
        icon,
        sort: i,
        active: true,
      });
    }
  }
  if ((await repos.checklistItems.count({ where: [eq('brandId', brandId)] })) === 0) {
    for (const [i, [kind, name, okLabel, faultLabel]] of CHECKLIST.entries()) {
      await repos.checklistItems.insert({
        ...base,
        id: `${brandId}__chk${i + 1}`,
        kind,
        name,
        okLabel,
        faultLabel,
        sort: i,
        active: true,
      });
    }
  }
  if ((await repos.cashCategories.count({ where: [eq('brandId', brandId)] })) === 0) {
    for (const [i, [type, code, en]] of CASH.entries()) {
      await repos.cashCategories.insert({
        ...base,
        id: `${brandId}__${code.toLowerCase()}`,
        type,
        code,
        name: { en },
        sort: i,
        active: true,
      });
    }
  }
}
