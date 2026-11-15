import { Tabs } from '@stopwash/ui';
import { useTranslation } from 'react-i18next';
import { PayrollRunTab } from './PayrollRunTab';

export function PayrollPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('legacy.runPayroll')}</h1>
      <Tabs
        aria-label={t('nav.payroll')}
        items={[{ value: 'run', label: t('payroll.tabs.run'), content: <PayrollRunTab /> }]}
      />
    </div>
  );
}
