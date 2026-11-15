import { Button, EmptyState, Skeleton, Tabs } from '@stopwash/ui';
import { useTranslation } from 'react-i18next';
import { errorKey } from '@/lib/api';
import { CatalogEditor } from './CatalogEditor';
import { BusinessProfileForm } from './BusinessProfileForm';
import { GeneralSettingsForm } from './GeneralSettingsForm';
import { CashCategoryEditor, ChecklistEditor } from './ListEditors';
import { useConfig } from './useConfig';

export function SettingsPage() {
  const { t } = useTranslation();
  const config = useConfig(true);

  let body;
  if (config.isLoading) {
    body = (
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  } else if (config.isError || !config.data) {
    body = (
      <EmptyState
        tone="danger"
        title={t(errorKey(config.error))}
        action={
          <Button variant="outline" onClick={() => void config.refetch()}>
            {t('state.retry')}
          </Button>
        }
      />
    );
  } else {
    body = (
      <Tabs
        aria-label={t('nav.settings')}
        items={[
          {
            value: 'general',
            label: t('settings.tabs.general'),
            content: <GeneralSettingsForm settings={config.data.settings} />,
          },
          {
            value: 'business',
            label: t('business.tab'),
            content: <BusinessProfileForm settings={config.data.settings} />,
          },
          {
            value: 'catalog',
            label: t('settings.tabs.catalog'),
            content: <CatalogEditor items={config.data.catalog} />,
          },
          {
            value: 'categories',
            label: t('settings.tabs.categories'),
            content: <CashCategoryEditor items={config.data.cashCategories} />,
          },
          {
            value: 'checklist',
            label: t('settings.tabs.checklist'),
            content: <ChecklistEditor items={config.data.checklistItems} />,
          },
        ]}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('nav.settings')}</h1>
      {body}
    </div>
  );
}
