import { APP_LANGUAGES, APP_LANGUAGE_LABELS, type AppLanguage, useI18n } from '../../../i18n';
import { useSpaceStore } from '../../../stores/spaceStore';
import { Icon } from '../../Icon';

export function MenuLanguagePage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const appLanguage = useSpaceStore((state) => state.appLanguage);
  const setAppLanguage = useSpaceStore((state) => state.setAppLanguage);
  const setLanguage = (nextLanguage: AppLanguage) => setAppLanguage(nextLanguage);

  return (
    <div className="menu-sheet-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={26} /></span>
        </button>
        <div className="menu-sheet-title">
          <small>{t('settings.section.language')}</small>
          <h2>{t('settings.language.title')}</h2>
        </div>
      </div>

      <section className="menu-section">
        <div className="settings-item menu-language-selector">
          <span className="settings-item-leading">
            <span className="settings-item-icon"><Icon name="compass" size={14} /></span>
            <span className="settings-item-copy">
              <strong>{t('settings.language.title')}</strong>
              <small>{t('settings.language.detail', { language: APP_LANGUAGE_LABELS[appLanguage] })}</small>
            </span>
          </span>
          <span className="menu-language-options" aria-label={t('language.current')}>
            {APP_LANGUAGES.map((option) => (
              <button
                key={option}
                type="button"
                className={`menu-language-option ${option === appLanguage ? 'active' : ''}`}
                aria-pressed={option === appLanguage}
                onClick={() => setLanguage(option)}
              >
                {option === 'zh-CN' ? t('language.zhCN') : t('language.enUS')}
              </button>
            ))}
          </span>
        </div>
        <p className="menu-section-note menu-language-note">{t('settings.language.help')}</p>
      </section>
    </div>
  );
}
