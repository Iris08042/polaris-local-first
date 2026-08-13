import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { MenuSheetItem } from './MenuSheetItem';

export function MenuSystemPage({ onBack, onCheckUpdate }: { onBack: () => void; onCheckUpdate: () => void }) {
  const { t } = useI18n();

  return (
    <div className="menu-sheet-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={26} /></span>
        </button>
        <div className="menu-sheet-title">
          <small>{t('settings.section.service')}</small>
          <h2>{t('settings.androidUpdate.title')}</h2>
        </div>
      </div>
      <section className="menu-section">
        <MenuSheetItem
          icon="download"
          title={t('settings.androidUpdate.title')}
          detail={t('settings.androidUpdate.detail')}
          helpText={t('settings.androidUpdate.help')}
          onClick={onCheckUpdate}
        />
      </section>
    </div>
  );
}
