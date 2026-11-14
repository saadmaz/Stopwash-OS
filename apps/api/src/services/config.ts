import type { Settings } from '@stopwash/shared';
import { AppError } from '../lib/errors';
import { eq, type Cond, type Repositories } from '../repos';
import { settingsId } from './defaults';

export async function getSettings(
  repos: Pick<Repositories, 'settings'>,
  brandId: string,
  locationId: string,
): Promise<Settings> {
  const rec = await repos.settings.get(settingsId(brandId, locationId));
  if (!rec || rec.brandId !== brandId)
    throw new AppError('NOT_FOUND', 'Location is not configured');
  return rec.settings;
}

/** Everything the counter needs to work, in one read (cached client-side and offline). */
export async function getConfig(
  repos: Pick<Repositories, 'settings' | 'catalog' | 'checklistItems' | 'cashCategories'>,
  brandId: string,
  locationId: string,
  includeInactive = false,
) {
  const scope = <T extends { brandId: string; active: boolean }>(): Cond<T>[] =>
    includeInactive ? [eq('brandId', brandId)] : [eq('brandId', brandId), eq('active', true)];
  const [settings, catalog, checklistItems, cashCategories] = await Promise.all([
    getSettings(repos, brandId, locationId),
    repos.catalog.find({ where: scope(), orderBy: { field: 'sort' } }),
    repos.checklistItems.find({ where: scope(), orderBy: { field: 'sort' } }),
    repos.cashCategories.find({ where: scope(), orderBy: { field: 'sort' } }),
  ]);
  return {
    locationId,
    settings,
    catalog: catalog.filter((c) => c.locationIds === null || c.locationIds.includes(locationId)),
    checklistItems,
    cashCategories,
  };
}
