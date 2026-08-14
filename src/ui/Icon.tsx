import { useId } from 'react';

export type IconName =
  | 'search'
  | 'editList'
  | 'plus'
  | 'brush'
  | 'settings'
  | 'send'
  | 'persona'
  | 'personaCreate'
  | 'personaCustom'
  | 'drawerGate'
  | 'sidebar'
  | 'navDialogue'
  | 'navCard'
  | 'navWorkspace'
  | 'navImage'
  | 'navInfo'
  | 'edit'
  | 'refresh'
  | 'more'
  | 'branch'
  | 'trash'
  | 'chevron'
  | 'chevronDown'
  | 'chevronUp'
  | 'lighthouse'
  | 'layers'
  | 'x'
  | 'pin'
  | 'code'
  | 'tag'
  | 'play'
  | 'voice'
  | 'sparkle'
  | 'copy'
  | 'download'
  | 'image'
  | 'camera'
  | 'pause'
  | 'folder'
  | 'cardStack'
  | 'infoCard'
  | 'wand'
  | 'orbit'
  | 'task'
  | 'sun'
  | 'providerRoute'
  | 'mcpServer'
  | 'mcpService'
  | 'mcpTimeout'
  | 'mcpJson'
  | 'mcpAdd'
  | 'polaris'
  | 'polarisStar'
  | 'check'
  | 'pharos'
  | 'eye'
  | 'fileText'
  | 'filePlus'
  | 'openBook'
  | 'memoryMap'
  | 'memoryShelf'
  | 'helpCircle'
  | 'fontImport'
  | 'promptScript'
  | 'promptMessage'
  | 'promptTone'
  | 'promptRules'
  | 'inbox'
  | 'feather'
  | 'zap'
  | 'compass';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 18, color = 'currentColor' }: Props) {
  const gradientId = useId().replace(/:/g, '');
  const taskOrbitGradientId = `taskOrbit${gradientId}`;
  const taskStarGradientId = `taskStar${gradientId}`;
  const polarisStarBodyGradientId = `polarisStarBody${gradientId}`;
  const polarisStarGlowGradientId = `polarisStarGlow${gradientId}`;
  const polarisStarGlintGradientId = `polarisStarGlint${gradientId}`;
  const polarisNavGradientId = `polarisNav${gradientId}`;
  const polarisNavLineGradientId = `polarisNavLine${gradientId}`;
  const personaCreateCardGradientId = `personaCreateCard${gradientId}`;
  const personaCreateSparkGradientId = `personaCreateSpark${gradientId}`;
  const personaCustomCardGradientId = `personaCustomCard${gradientId}`;
  const personaCustomInkGradientId = `personaCustomInk${gradientId}`;
  const polarisStarDeepSpace = color === 'polarisDeepSpace';
  const navGradientActive = color === 'polarisNavGradient';
  const navGradientLine = color === 'polarisNavLineGradient';
  const navFill = navGradientActive
    ? `url(#${polarisNavGradientId})`
    : navGradientLine
      ? `url(#${polarisNavLineGradientId})`
      : color;
  const navDetail = navGradientActive ? 'rgba(255,255,255,0.68)' : navFill;
  const navSoftDetail = navGradientActive ? 'rgba(255,255,255,0.48)' : navFill;
  const navActive = color === 'polarisNavGradient';
  const navDefs = navGradientActive || navGradientLine
    ? (
      <defs>
        {navGradientActive ? (
          <linearGradient id={polarisNavGradientId} x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8fe8ff" />
            <stop offset="0.38" stopColor="#a98dff" />
            <stop offset="0.68" stopColor="#fff08a" />
            <stop offset="1" stopColor="#ff9fce" />
          </linearGradient>
        ) : null}
        {navGradientLine ? (
          <linearGradient id={polarisNavLineGradientId} x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8d879b" />
            <stop offset="0.48" stopColor="#9d92bb" />
            <stop offset="1" stopColor="#b2a071" />
          </linearGradient>
        ) : null}
      </defs>
    )
    : null;
  const stroke = 1.75;
  const strokeSoft = 1.58;
  const strokeBold = 2.1;
  const strokeDetail = 1.38;

  const icons: Record<IconName, JSX.Element> = {
    search: <><circle cx="11" cy="11" r="6" fill="none" stroke={color} strokeWidth={stroke}/><line x1="16" y1="16" x2="20" y2="20" stroke={color} strokeWidth={stroke} strokeLinecap="round"/></>,
    editList: <>
      <rect x="4.2" y="5.1" width="4.9" height="4.9" rx="1.25" fill="none" stroke={color} strokeWidth={strokeSoft} />
      <rect x="10.7" y="5.1" width="4.9" height="4.9" rx="1.25" fill="none" stroke={color} strokeWidth={strokeSoft} opacity="0.9" />
      <rect x="4.2" y="11.6" width="4.9" height="4.9" rx="1.25" fill="none" stroke={color} strokeWidth={strokeSoft} opacity="0.86" />
      <circle cx="15.8" cy="15.5" r="3.7" fill="none" stroke={color} strokeWidth={stroke} />
      <line x1="18.5" y1="18.15" x2="20.6" y2="20.25" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
    </>,
    plus: <><line x1="12" y1="5.5" x2="12" y2="18.5" stroke={color} strokeWidth={strokeBold} strokeLinecap="round"/><line x1="5.5" y1="12" x2="18.5" y2="12" stroke={color} strokeWidth={strokeBold} strokeLinecap="round"/></>,
    brush: <><path d="M18 4L8 14C7 15 6 17 7 18C8 19 10 18 11 17L20 6C20.5 5.5 20.5 4.5 20 4C19.5 3.5 18.5 3.5 18 4Z" fill="none" stroke={color} strokeWidth={stroke}/><circle cx="7" cy="18" r="2" fill="none" stroke={color} strokeWidth={stroke}/></>,
    settings: <><circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth={stroke}/><path d="M12 2V4M12 20V22M2 12H4M20 12H22M4.9 4.9L6.3 6.3M17.7 17.7L19.1 19.1M4.9 19.1L6.3 17.7M17.7 6.3L19.1 4.9" stroke={color} strokeWidth={stroke} strokeLinecap="round"/></>,
    send: <><path d="M22 2L11 13" stroke={color} strokeWidth={stroke} strokeLinecap="round"/><polygon points="22,2 15,22 11,13 2,9" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round"/></>,
    persona: <><circle cx="12" cy="8" r="4" fill="none" stroke={color} strokeWidth={stroke}/><path d="M5 20C5 17 8 14 12 14C16 14 19 17 19 20" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"/></>,
    personaCreate: <>
      <defs>
        <linearGradient id={personaCreateCardGradientId} x1="4.4" y1="4.2" x2="19.8" y2="19.8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f8fbff" />
          <stop offset="0.45" stopColor="#dbe8f7" />
          <stop offset="1" stopColor="#17345d" />
        </linearGradient>
        <linearGradient id={personaCreateSparkGradientId} x1="7.1" y1="5.8" x2="18.5" y2="18.2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8bdfff" />
          <stop offset="0.48" stopColor="#bba4ff" />
          <stop offset="1" stopColor="#f2c86b" />
        </linearGradient>
      </defs>
      <path d="M5.15 7.2C5.15 6 6.12 5.05 7.32 5.05H15.05L18.85 8.88V16.75C18.85 17.95 17.88 18.95 16.66 18.95H7.32C6.12 18.95 5.15 17.98 5.15 16.78V7.2Z" fill={`url(#${personaCreateCardGradientId})`} fillOpacity="0.18" stroke={color} strokeWidth="1.34" strokeLinejoin="round" />
      <path d="M15.05 5.05V8.22C15.05 8.66 15.4 9.02 15.84 9.02H18.85" fill="none" stroke={color} strokeWidth="1.18" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <path d="M11.58 8.18L12.46 10.96L15.18 11.82L12.46 12.68L11.58 15.46L10.72 12.68L8 11.82L10.72 10.96L11.58 8.18Z" fill={`url(#${personaCreateSparkGradientId})`} />
      <path d="M17.25 12.95L17.68 14.2L18.92 14.62L17.68 15.04L17.25 16.3L16.82 15.04L15.58 14.62L16.82 14.2L17.25 12.95Z" fill={`url(#${personaCreateSparkGradientId})`} opacity="0.78" />
      <path d="M7.55 7.48H10.02" fill="none" stroke={color} strokeWidth="1.12" strokeLinecap="round" opacity="0.42" />
      <path d="M7.55 16.22H13.7" fill="none" stroke={color} strokeWidth="1.12" strokeLinecap="round" opacity="0.38" />
    </>,
    personaCustom: <>
      <defs>
        <linearGradient id={personaCustomCardGradientId} x1="4.6" y1="5.2" x2="19.4" y2="18.8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#eef5fb" />
          <stop offset="0.54" stopColor="#d7e2ee" />
          <stop offset="1" stopColor="#17345d" />
        </linearGradient>
        <linearGradient id={personaCustomInkGradientId} x1="8.5" y1="9" x2="17.1" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#17345d" />
          <stop offset="0.68" stopColor="#315f94" />
          <stop offset="1" stopColor="#c7a45a" />
        </linearGradient>
      </defs>
      <path d="M6.05 6.25C6.05 5.62 6.56 5.1 7.2 5.1H16.8C17.44 5.1 17.95 5.62 17.95 6.25V17.75C17.95 18.38 17.44 18.9 16.8 18.9H7.2C6.56 18.9 6.05 18.38 6.05 17.75V6.25Z" fill={`url(#${personaCustomCardGradientId})`} fillOpacity="0.16" stroke={color} strokeWidth="1.34" />
      <path d="M9.1 8.12H14.9" fill="none" stroke={color} strokeWidth="1.12" strokeLinecap="round" opacity="0.36" />
      <path d="M9.1 10.9H12.8" fill="none" stroke={color} strokeWidth="1.12" strokeLinecap="round" opacity="0.3" />
      <path d="M10.06 15.05L10.42 12.96L14.76 8.62C15.22 8.16 15.98 8.16 16.44 8.62L16.72 8.9C17.18 9.36 17.18 10.1 16.72 10.56L12.36 14.92L10.06 15.05Z" fill="none" stroke={`url(#${personaCustomInkGradientId})`} strokeWidth="1.34" strokeLinejoin="round" />
      <path d="M14.02 9.42L15.92 11.32" fill="none" stroke={`url(#${personaCustomInkGradientId})`} strokeWidth="1.16" strokeLinecap="round" opacity="0.88" />
      <path d="M9.1 16.6H15.2" fill="none" stroke={color} strokeWidth="1.12" strokeLinecap="round" opacity="0.34" />
    </>,
    drawerGate: <>
      <rect x="3.3" y="6.5" width="14.8" height="3.1" rx="1.55" fill={color} fillOpacity="0.96" />
      <rect x="3.9" y="14.4" width="10.4" height="3.1" rx="1.55" fill={color} fillOpacity="0.88" />
      <path d="M17.3 4.3L18.25 6.85L20.8 7.8L18.25 8.75L17.3 11.3L16.35 8.75L13.8 7.8L16.35 6.85L17.3 4.3Z" fill={color} fillOpacity="0.38" />
    </>,
    sidebar: <>
      <rect x="4.2" y="5.1" width="15.6" height="13.8" rx="2.7" fill="none" stroke={color} strokeWidth={stroke} />
      <path d="M9.2 5.35V18.65" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" opacity="0.82" />
      <path d="M12.4 9.2H16.4M12.4 12H16.4M12.4 14.8H15.2" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.72" />
    </>,
    navDialogue: <>
      {navDefs}
      {navActive ? (
        <>
          <path d="M19.95 4.55L15.9 19.1C15.64 20.03 14.46 20.32 13.8 19.6L10.35 15.82L7.05 18.12C6.32 18.63 5.32 18.1 5.32 17.2V13.1L3.92 11.55C3.26 10.82 3.58 9.66 4.54 9.42L18.5 3.15C19.38 2.76 20.2 3.62 19.95 4.55Z" fill={navFill} />
          <path d="M10.35 15.82L12.45 11.35L17.95 5.6L8.42 12.9L10.35 15.82Z" fill={navDetail} fillOpacity="0.86" />
        </>
      ) : (
        <>
          <path d="M19.1 4.9L15.15 18.85L10.1 14.1L5 17.55V13.05L3.9 11.65L19.1 4.9Z" fill="none" stroke={navFill} strokeWidth={strokeBold} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.1 14.1L12.25 10.95L19.1 4.9" fill="none" stroke={navSoftDetail} strokeWidth={strokeSoft} strokeLinecap="round" strokeLinejoin="round" opacity="0.72" />
        </>
      )}
    </>,
    navCard: <>
      {navDefs}
      {navActive ? (
        <>
          <path d="M4.85 10.45H19.15V17.9C19.15 18.72 18.48 19.4 17.65 19.4H6.35C5.52 19.4 4.85 18.72 4.85 17.9V10.45Z" fill={navFill} />
          <path d="M4 7.45C4 6.7 4.6 6.1 5.35 6.1H18.65C19.4 6.1 20 6.7 20 7.45V10.6H4V7.45Z" fill={navFill} fillOpacity="0.94" />
          <path d="M12 6.1V19.4" stroke={navDetail} strokeWidth="1.72" strokeLinecap="round" />
          <path d="M8.05 5.98C7.05 5.18 6.96 3.92 7.82 3.38C9.08 2.58 11.02 4.16 12 6.1C12.98 4.16 14.92 2.58 16.18 3.38C17.04 3.92 16.95 5.18 15.95 5.98H8.05Z" fill={navFill} fillOpacity="0.82" />
          <path d="M4 10.6H20" stroke={navSoftDetail} strokeWidth="1.55" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M4.85 10.45H19.15V17.9C19.15 18.72 18.48 19.4 17.65 19.4H6.35C5.52 19.4 4.85 18.72 4.85 17.9V10.45Z" fill="none" stroke={color} strokeWidth={strokeBold} strokeLinejoin="round" />
          <path d="M4 7.45C4 6.7 4.6 6.1 5.35 6.1H18.65C19.4 6.1 20 6.7 20 7.45V10.6H4V7.45Z" fill="none" stroke={color} strokeWidth={strokeBold} strokeLinejoin="round" />
          <path d="M12 6.1V19.4" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" />
          <path d="M8.05 5.98C7.05 5.18 6.96 3.92 7.82 3.38C9.08 2.58 11.02 4.16 12 6.1C12.98 4.16 14.92 2.58 16.18 3.38C17.04 3.92 16.95 5.18 15.95 5.98H8.05Z" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinejoin="round" />
        </>
      )}
    </>,
    navWorkspace: <>
      {navDefs}
      {navActive ? (
        <>
          <path d="M4.45 7.35C4.45 6.12 5.44 5.15 6.66 5.15H9.52L11.45 7.12H17.3C18.54 7.12 19.55 8.13 19.55 9.37V16.55C19.55 17.79 18.54 18.8 17.3 18.8H6.7C5.46 18.8 4.45 17.79 4.45 16.55V7.35Z" fill={navFill} />
          <path d="M12 9.55L12.7 11.3L14.45 12L12.7 12.7L12 14.45L11.3 12.7L9.55 12L11.3 11.3L12 9.55Z" fill={navDetail} />
          <rect x="7" y="14.7" width="6.8" height="1.55" rx="0.78" fill={navSoftDetail} />
        </>
      ) : (
        <>
          <path d="M4.45 7.35C4.45 6.12 5.44 5.15 6.66 5.15H9.52L11.45 7.12H17.3C18.54 7.12 19.55 8.13 19.55 9.37V16.55C19.55 17.79 18.54 18.8 17.3 18.8H6.7C5.46 18.8 4.45 17.79 4.45 16.55V7.35Z" fill="none" stroke={color} strokeWidth={strokeBold} strokeLinejoin="round" />
          <path d="M12 9.55L12.7 11.3L14.45 12L12.7 12.7L12 14.45L11.3 12.7L9.55 12L11.3 11.3L12 9.55Z" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinejoin="round" />
        </>
      )}
    </>,
    navImage: <>
      {navDefs}
      {navActive ? (
        <>
          <rect x="4.7" y="5.1" width="14.6" height="13.8" rx="3.1" fill={navFill} />
          <circle cx="9" cy="9.25" r="1.55" fill={navDetail} />
          <path d="M6.9 16L10.1 12.5L12.55 14.75L14.55 12.55L17.55 16H6.9Z" fill={navSoftDetail} />
          <path d="M15.35 5.1L15.92 6.48L17.3 7.05L15.92 7.62L15.35 9L14.78 7.62L13.4 7.05L14.78 6.48L15.35 5.1Z" fill={navFill} fillOpacity="0.56" />
        </>
      ) : (
        <>
          <rect x="4.7" y="5.1" width="14.6" height="13.8" rx="3.1" fill="none" stroke={color} strokeWidth={strokeBold} />
          <circle cx="9" cy="9.25" r="1.35" fill="none" stroke={color} strokeWidth={strokeSoft} />
          <path d="M6.9 16L10.1 12.5L12.55 14.75L14.55 12.55L17.55 16" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </>,
    navInfo: <>
      {navDefs}
      {navActive ? (
        <>
          <path d="M12 3.85L19.15 8.05V15.95L12 20.15L4.85 15.95V8.05L12 3.85Z" fill={navFill} />
          <path d="M12 7.25L13.08 10.92L16.75 12L13.08 13.08L12 16.75L10.92 13.08L7.25 12L10.92 10.92L12 7.25Z" fill={navDetail} />
        </>
      ) : (
        <>
          <path d="M12 3.85L19.15 8.05V15.95L12 20.15L4.85 15.95V8.05L12 3.85Z" fill="none" stroke={color} strokeWidth={strokeBold} strokeLinejoin="round" />
          <path d="M12 7.25L13.08 10.92L16.75 12L13.08 13.08L12 16.75L10.92 13.08L7.25 12L10.92 10.92L12 7.25Z" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinejoin="round" />
        </>
      )}
    </>,
    edit: <><path d="M5 19L5.5 15.5L15.2 5.8C15.9 5.1 17 5.1 17.7 5.8L18.2 6.3C18.9 7 18.9 8.1 18.2 8.8L8.5 18.5L5 19Z" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round"/><line x1="13.8" y1="7.2" x2="16.8" y2="10.2" stroke={color} strokeWidth={stroke} strokeLinecap="round"/></>,
    refresh: <><path d="M19 8.5A7 7 0 1 0 20 14" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"/><polyline points="15,4.5 19.5,8.5 14.5,11" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"/></>,
    more: <><circle cx="6.5" cy="12" r="1.25" fill={color}/><circle cx="12" cy="12" r="1.25" fill={color}/><circle cx="17.5" cy="12" r="1.25" fill={color}/></>,
    branch: <><circle cx="7" cy="6.5" r="2" fill="none" stroke={color} strokeWidth={stroke}/><circle cx="17" cy="6.5" r="2" fill="none" stroke={color} strokeWidth={stroke}/><circle cx="12" cy="18" r="2" fill="none" stroke={color} strokeWidth={stroke}/><path d="M7 8.5V10C7 11.4 8.1 12.5 9.5 12.5H14.5C15.9 12.5 17 11.4 17 10V8.5" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"/><path d="M12 12.5V16" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"/></>,
    trash: <><path d="M5.5 7.5H18.5" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"/><path d="M9 7.5V5.5C9 4.9 9.4 4.5 10 4.5H14C14.6 4.5 15 4.9 15 5.5V7.5" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"/><path d="M7.5 7.5L8.3 18.2C8.4 19.2 9.2 20 10.2 20H13.8C14.8 20 15.6 19.2 15.7 18.2L16.5 7.5" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round"/><line x1="10" y1="10.5" x2="10.5" y2="16" stroke={color} strokeWidth={stroke} strokeLinecap="round"/><line x1="14" y1="10.5" x2="13.5" y2="16" stroke={color} strokeWidth={stroke} strokeLinecap="round"/></>,
    chevron: <><polyline points="9,6 15,12 9,18" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"/></>,
    chevronDown: <><polyline points="6,9 12,15 18,9" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"/></>,
    chevronUp: <><polyline points="6,15 12,9 18,15" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"/></>,
    check: <><polyline points="5.5,12.5 10,17 18.5,8.5" fill="none" stroke={color} strokeWidth={strokeBold} strokeLinecap="round" strokeLinejoin="round"/></>,
    lighthouse: <><path d="M12 2L14 8H10L12 2Z" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round"/><rect x="9" y="8" width="6" height="10" rx="1" fill="none" stroke={color} strokeWidth={stroke}/><line x1="12" y1="18" x2="12" y2="22" stroke={color} strokeWidth={stroke}/><line x1="7" y1="22" x2="17" y2="22" stroke={color} strokeWidth={stroke} strokeLinecap="round"/><line x1="6" y1="5" x2="8" y2="5" stroke={color} strokeWidth={stroke} strokeLinecap="round"/><line x1="16" y1="5" x2="18" y2="5" stroke={color} strokeWidth={stroke} strokeLinecap="round"/></>,
    layers: <><polygon points="12,2 22,8.5 12,15 2,8.5" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round"/><polyline points="2,15 12,21.5 22,15" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round"/></>,
    x: <><line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={stroke} strokeLinecap="round"/><line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={stroke} strokeLinecap="round"/></>,
    pin: <><path d="M15 4.5L19.5 9L14 14.5L12 20L4 12L9.5 10L15 4.5Z" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round"/><line x1="4" y1="20" x2="9" y2="15" stroke={color} strokeWidth={stroke} strokeLinecap="round"/></>,
    code: <><polyline points="8,6 3,12 8,18" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"/><polyline points="16,6 21,12 16,18" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"/></>,
    tag: <><path d="M4 4H10L20 14L14 20L4 10V4Z" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round"/><circle cx="8" cy="8" r="1" fill={color}/></>,
    play: <><polygon points="8,6 19,12 8,18" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round"/></>,
    voice: <>
      <path d="M5.2 10.15H8.05L12.05 6.1C12.7 5.44 13.75 5.9 13.75 6.83V17.17C13.75 18.1 12.7 18.56 12.05 17.9L8.05 13.85H5.2V10.15Z" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" />
      <path d="M16.25 9.1C17.1 10.12 17.1 12.88 16.25 13.9" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" />
      <path d="M18.4 7.15C20.12 9.35 20.12 14.65 18.4 16.85" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" opacity="0.72" />
    </>,
    pause: <><line x1="9" y1="6.5" x2="9" y2="17.5" stroke={color} strokeWidth={strokeBold} strokeLinecap="round"/><line x1="15" y1="6.5" x2="15" y2="17.5" stroke={color} strokeWidth={strokeBold} strokeLinecap="round"/></>,
    sparkle: <><path d="M12 4L13.8 10.2L20 12L13.8 13.8L12 20L10.2 13.8L4 12L10.2 10.2L12 4Z" fill={color} fillOpacity="0.92"/></>,
    copy: <><rect x="9" y="9" width="10" height="11" rx="2" fill="none" stroke={color} strokeWidth={stroke}/><path d="M7 15H6C4.9 15 4 14.1 4 13V6C4 4.9 4.9 4 6 4H13C14.1 4 15 4.9 15 6V7" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"/></>,
    download: <>
      <path d="M12 4.5V14.2" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      <path d="M8.9 11.5L12 14.7L15.1 11.5" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 17.4C6 16.85 6.45 16.4 7 16.4H17C17.55 16.4 18 16.85 18 17.4V18.3C18 18.85 17.55 19.3 17 19.3H7C6.45 19.3 6 18.85 6 18.3V17.4Z" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" />
    </>,
    image: <><rect x="4" y="5" width="16" height="14" rx="3" fill="none" stroke={color} strokeWidth={stroke}/><circle cx="9" cy="10" r="1.5" fill={color}/><path d="M7 16L11 12.5L13.8 15L16 13L19 16" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"/></>,
    camera: <><path d="M8 7L9.3 5.2C9.5 4.9 9.8 4.8 10.2 4.8H13.8C14.2 4.8 14.5 4.9 14.7 5.2L16 7H18C19.1 7 20 7.9 20 9V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V9C4 7.9 4.9 7 6 7H8Z" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke={color} strokeWidth={stroke}/></>,
    folder: <><path d="M4 7.5C4 6.7 4.7 6 5.5 6H9L10.8 8H18.5C19.3 8 20 8.7 20 9.5V17.5C20 18.3 19.3 19 18.5 19H5.5C4.7 19 4 18.3 4 17.5V7.5Z" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round"/></>,
    cardStack: <>
      <rect x="6.2" y="5.4" width="10.8" height="12.2" rx="2.2" fill="none" stroke={color} strokeWidth={strokeDetail} opacity="0.46" />
      <path d="M9 8.4H16.3C17.46 8.4 18.4 9.34 18.4 10.5V17.8C18.4 18.96 17.46 19.9 16.3 19.9H8.9C7.74 19.9 6.8 18.96 6.8 17.8V10.6C6.8 9.38 7.78 8.4 9 8.4Z" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" />
      <path d="M9.7 12H15.5" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" opacity="0.88" />
      <path d="M9.7 15.1H13.8" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" opacity="0.7" />
    </>,
    infoCard: <>
      <rect x="4.8" y="5.3" width="14.4" height="13.4" rx="3" fill="none" stroke={color} strokeWidth={strokeSoft} />
      <circle cx="8.5" cy="10.3" r="1.3" fill={color} fillOpacity="0.92" />
      <path d="M11.3 10.35H15.95" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.9" />
      <path d="M7.15 14.1H12.35" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.72" />
      <path d="M14.55 14.2L17.8 10.95C18.22 10.53 18.9 10.53 19.32 10.95L19.55 11.18C19.97 11.6 19.97 12.28 19.55 12.7L16.3 15.95L14.2 16.28L14.55 14.2Z" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinejoin="round" />
      <path d="M17.05 11.7L18.8 13.45" fill="none" stroke={color} strokeWidth="1.26" strokeLinecap="round" />
    </>,
    wand: <>
      <g transform="translate(2.9 0.6) scale(0.226)">
        <rect x="20" y="68" width="72" height="8" rx="3" transform="rotate(-45 20 68)" fill={color} opacity="0.78"/>
        <rect x="20" y="68" width="18" height="8" rx="3" transform="rotate(-45 20 68)" fill={color} opacity="0.98"/>
        <path d="M18 18l3.5 7.5L29 29l-7.5 3.5L18 40l-3.5-7.5L7 29l7.5-3.5z" fill={color} opacity="0.95"/>
        <path d="M42 8l1.5 4L48 14l-4.5 1.5L42 20l-1.5-4.5L36 14l4.5-1.5z" fill={color} opacity="0.58"/>
        <path d="M6 38l1.2 3L11 43l-3.8 1.2L6 48l-1.2-3.8L1 43l3.8-1.2z" fill={color} opacity="0.48"/>
        <circle cx="30" cy="6" r="1.5" fill={color} opacity="0.42"/>
        <circle cx="3" cy="26" r="1.2" fill={color} opacity="0.34"/>
        <circle cx="38" cy="28" r="1" fill={color} opacity="0.28"/>
      </g>
    </>,
    orbit: <>
      <ellipse cx="12" cy="12" rx="7.2" ry="3.8" fill="none" stroke={color} strokeWidth={strokeDetail} opacity="0.9" />
      <ellipse cx="12" cy="12" rx="7.2" ry="3.8" fill="none" stroke={color} strokeWidth={strokeDetail} opacity="0.42" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="7.2" ry="3.8" fill="none" stroke={color} strokeWidth={strokeDetail} opacity="0.22" transform="rotate(120 12 12)" />
      <circle cx="12" cy="12" r="1.55" fill={color} fillOpacity="0.92" />
    </>,
    task: <>
      <defs>
        <linearGradient id={taskOrbitGradientId} x1="5.2" y1="5.4" x2="18.8" y2="18.6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#82c8ff" />
          <stop offset="0.48" stopColor="#d9b7ff" />
          <stop offset="1" stopColor="#ffd985" />
        </linearGradient>
        <linearGradient id={taskStarGradientId} x1="9.45" y1="9.45" x2="14.55" y2="14.55" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.62" stopColor="#fff1b8" />
          <stop offset="1" stopColor="#8fd8ff" />
        </linearGradient>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="6.95"
        fill="none"
        stroke={`url(#${taskOrbitGradientId})`}
        strokeWidth="2.24"
        strokeLinecap="round"
        strokeDasharray="36.5 7.2"
        strokeDashoffset="2.8"
        transform="rotate(-42 12 12)"
      />
      <path
        d="M12 9.55L12.76 11.24L14.45 12L12.76 12.76L12 14.45L11.24 12.76L9.55 12L11.24 11.24L12 9.55Z"
        fill={`url(#${taskStarGradientId})`}
        fillOpacity="0.98"
      />
    </>,
    sun: <><circle cx="12" cy="12" r="4.2" fill="none" stroke={color} strokeWidth={stroke}/><path d="M12 2.8V5.2M12 18.8V21.2M21.2 12H18.8M5.2 12H2.8M18.5 5.5L16.8 7.2M7.2 16.8L5.5 18.5M18.5 18.5L16.8 16.8M7.2 7.2L5.5 5.5" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"/></>,
    providerRoute: <>
      <rect x="4.8" y="5.2" width="8" height="13.6" rx="2.1" fill="none" stroke={color} strokeWidth={strokeSoft} />
      <path d="M9 9.1H12.3" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" />
      <path d="M9 12H12.3" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.84" />
      <path d="M9 14.9H11.1" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.68" />
      <path d="M13.8 9.2H16.3C17.85 9.2 19.1 10.45 19.1 12C19.1 13.55 17.85 14.8 16.3 14.8H13.8" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" />
      <path d="M16.1 10.3L18.2 12L16.1 13.7" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" strokeLinejoin="round" />
    </>,
    mcpServer: <>
      <rect x="5.1" y="5.45" width="9.25" height="13.1" rx="2.15" fill="none" stroke={color} strokeWidth={strokeSoft} />
      <path d="M8 8.35H11.55" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" />
      <path d="M8 11.05H11.55" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.82" />
      <path d="M8 13.75H10.5" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.66" />
      <circle cx="17.55" cy="8.2" r="1.75" fill="none" stroke={color} strokeWidth={strokeDetail} />
      <circle cx="17.55" cy="15.8" r="1.75" fill="none" stroke={color} strokeWidth={strokeDetail} />
      <path d="M14.35 9.1H15.95" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" />
      <path d="M14.35 14.9H15.95" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" />
      <path d="M17.55 10.05V13.95" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.72" />
    </>,
    mcpService: <>
      <path d="M12 5.05L17.9 8.45V15.55L12 18.95L6.1 15.55V8.45L12 5.05Z" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinejoin="round" />
      <path d="M12 8.85L14.62 10.38V13.62L12 15.15L9.38 13.62V10.38L12 8.85Z" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinejoin="round" opacity="0.9" />
      <path d="M12 5.25V8.6M17.68 8.55L14.78 10.22M17.68 15.45L14.78 13.78M12 18.75V15.4M6.32 15.45L9.22 13.78M6.32 8.55L9.22 10.22" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.72" />
    </>,
    mcpTimeout: <>
      <circle cx="11.3" cy="12.2" r="5.9" fill="none" stroke={color} strokeWidth={strokeSoft} />
      <path d="M11.3 8.9V12.35L13.75 13.95" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.3 5.15V4.1" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" />
      <circle cx="17.8" cy="7.8" r="1.35" fill="none" stroke={color} strokeWidth={strokeDetail} />
      <path d="M16.55 8.75L15.2 10.1" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" />
    </>,
    mcpJson: <>
      <path d="M7.65 6.3C6.55 6.3 5.9 6.95 5.9 8.05V9.25C5.9 10.15 5.45 10.74 4.6 11V11.02C5.45 11.28 5.9 11.86 5.9 12.77V13.97C5.9 15.07 6.55 15.72 7.65 15.72" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.35 6.3C17.45 6.3 18.1 6.95 18.1 8.05V9.25C18.1 10.15 18.55 10.74 19.4 11V11.02C18.55 11.28 18.1 11.86 18.1 12.77V13.97C18.1 15.07 17.45 15.72 16.35 15.72" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10.2" cy="9.15" r="1" fill={color} fillOpacity="0.92" />
      <circle cx="10.2" cy="12.85" r="1" fill={color} fillOpacity="0.92" />
      <path d="M12.2 9.2H14.65" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" />
      <path d="M12.2 12.85H15.7" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.88" />
    </>,
    mcpAdd: <>
      <path d="M6.1 8.25C6.1 7.3 6.86 6.55 7.8 6.55H11.7C12.65 6.55 13.4 7.3 13.4 8.25V11.3C13.4 12.25 12.65 13 11.7 13H7.8C6.86 13 6.1 12.25 6.1 11.3V8.25Z" fill="none" stroke={color} strokeWidth={strokeSoft} />
      <path d="M8.45 6.55V4.65M11.05 6.55V4.65M8.45 13V15.2M11.05 13V15.2" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" />
      <path d="M13.45 9.78H16.2C17.35 9.78 18.25 10.68 18.25 11.82V13.05" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" />
      <path d="M17.95 15.05V20.05" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" />
      <path d="M15.45 17.55H20.45" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" />
    </>,
    polarisStar: <>
      <defs>
        <radialGradient id={polarisStarGlowGradientId} cx="50%" cy="46%" r="58%">
          <stop offset="0" stopColor={polarisStarDeepSpace ? '#9bd9ff' : '#fff7b8'} stopOpacity={polarisStarDeepSpace ? '0.48' : '0.88'} />
          <stop offset="0.48" stopColor={polarisStarDeepSpace ? '#224c9d' : '#80dcff'} stopOpacity={polarisStarDeepSpace ? '0.28' : '0.32'} />
          <stop offset="1" stopColor={polarisStarDeepSpace ? '#071027' : '#a98dff'} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={polarisStarBodyGradientId} x1="6.1" y1="5.2" x2="18.2" y2="18.6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={polarisStarDeepSpace ? '#163d8a' : '#9ee9ff'} />
          <stop offset="0.36" stopColor={polarisStarDeepSpace ? '#0d235a' : '#6fcaff'} />
          <stop offset="0.58" stopColor={polarisStarDeepSpace ? '#071331' : '#fff08a'} />
          <stop offset="0.82" stopColor={polarisStarDeepSpace ? '#102456' : '#ffd16d'} />
          <stop offset="1" stopColor={polarisStarDeepSpace ? '#274f9f' : '#f7a7dc'} />
        </linearGradient>
        <linearGradient id={polarisStarGlintGradientId} x1="8.6" y1="6.4" x2="15.7" y2="17.6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={polarisStarDeepSpace ? '#d9f2ff' : '#ffffff'} stopOpacity={polarisStarDeepSpace ? '0.82' : '0.96'} />
          <stop offset="0.44" stopColor={polarisStarDeepSpace ? '#8dc7ff' : '#fff7c9'} stopOpacity={polarisStarDeepSpace ? '0.3' : '0.42'} />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M12 3.05L14.22 9.78L20.95 12L14.22 14.22L12 20.95L9.78 14.22L3.05 12L9.78 9.78L12 3.05Z"
        fill={`url(#${polarisStarGlowGradientId})`}
        opacity="0.72"
      />
      <path
        d="M12 4L13.8 10.2L20 12L13.8 13.8L12 20L10.2 13.8L4 12L10.2 10.2L12 4Z"
        fill={`url(#${polarisStarBodyGradientId})`}
        fillOpacity="0.98"
      />
      <path
        d="M12 5.75L12.84 10.98L18.2 12L12.88 12.88L12 18.2L11.1 12.88L5.8 12L11 10.98L12 5.75Z"
        fill={`url(#${polarisStarGlintGradientId})`}
        opacity="0.48"
      />
    </>,
    pharos: <>
      <path d="M12 3.6L19.4 11L12 20.4L4.6 11L12 3.6Z" fill="none" stroke={color} strokeWidth="1.85" strokeLinejoin="round"/>
      <path d="M12 7L16 11L12 16L8 11L12 7Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
    </>,
    polaris: <>
      <defs>
        <radialGradient id={`polarisGlow${gradientId}`} cx="50%" cy="46%" r="58%">
          <stop offset="0" stopColor="#fff7b8" stopOpacity="0.88" />
          <stop offset="0.48" stopColor="#80dcff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#a98dff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`polaris${gradientId}`} x1="6.1" y1="5.2" x2="18.2" y2="18.6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9ee9ff" />
          <stop offset="0.36" stopColor="#6fcaff" />
          <stop offset="0.58" stopColor="#fff08a" />
          <stop offset="0.82" stopColor="#ffd16d" />
          <stop offset="1" stopColor="#f7a7dc" />
        </linearGradient>
        <linearGradient id={`polarisGlint${gradientId}`} x1="8.6" y1="6.4" x2="15.7" y2="17.6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.96" />
          <stop offset="0.44" stopColor="#fff7c9" stopOpacity="0.42" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M12 3.05L14.22 9.78L20.95 12L14.22 14.22L12 20.95L9.78 14.22L3.05 12L9.78 9.78L12 3.05Z"
        fill={`url(#polarisGlow${gradientId})`}
        opacity="0.72"
      />
      <path
        d="M12 4L13.8 10.2L20 12L13.8 13.8L12 20L10.2 13.8L4 12L10.2 10.2L12 4Z"
        fill={`url(#polaris${gradientId})`}
        fillOpacity="0.98"
      />
      <path
        d="M12 5.75L12.84 10.98L18.2 12L12.88 12.88L12 18.2L11.1 12.88L5.8 12L11 10.98L12 5.75Z"
        fill={`url(#polarisGlint${gradientId})`}
        opacity="0.48"
      />
    </>,
    eye: <>
      <defs>
        <linearGradient id={`eyeGrad${gradientId}`} x1="4.6" y1="7.4" x2="19.4" y2="16.6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={color} stopOpacity="0.86" />
          <stop offset="0.56" stopColor={color} stopOpacity="0.58" />
          <stop offset="1" stopColor={color} stopOpacity="0.78" />
        </linearGradient>
      </defs>
      <path
        d="M3.9 12C5.75 8.95 8.52 7.35 12 7.35C15.48 7.35 18.25 8.95 20.1 12C18.25 15.05 15.48 16.65 12 16.65C8.52 16.65 5.75 15.05 3.9 12Z"
        fill="none"
        stroke={`url(#eyeGrad${gradientId})`}
        strokeWidth={strokeSoft}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.85" fill="none" stroke={color} strokeWidth={strokeSoft} opacity="0.86" />
      <circle cx="12" cy="12" r="1.05" fill={color} fillOpacity="0.82" />
    </>,
    memoryMap: <>
      <path d="M5.25 6.55C5.25 5.72 5.92 5.05 6.75 5.05H10.35C11.18 5.05 11.85 5.72 11.85 6.55V9.35C11.85 10.18 11.18 10.85 10.35 10.85H6.75C5.92 10.85 5.25 10.18 5.25 9.35V6.55Z" fill="none" stroke={color} strokeWidth={strokeSoft} />
      <path d="M13.65 13.15C13.65 12.32 14.32 11.65 15.15 11.65H18.15C18.98 11.65 19.65 12.32 19.65 13.15V17.45C19.65 18.28 18.98 18.95 18.15 18.95H15.15C14.32 18.95 13.65 18.28 13.65 17.45V13.15Z" fill="none" stroke={color} strokeWidth={strokeSoft} />
      <path d="M5.25 15.1C5.25 14.3 5.9 13.65 6.7 13.65H9.65C10.45 13.65 11.1 14.3 11.1 15.1V17.5C11.1 18.3 10.45 18.95 9.65 18.95H6.7C5.9 18.95 5.25 18.3 5.25 17.5V15.1Z" fill="none" stroke={color} strokeWidth={strokeSoft} opacity="0.78" />
      <path d="M12.15 7.95H14.1C15.2 7.95 16.1 8.85 16.1 9.95V11.55" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.62" />
      <path d="M11.18 16.3H13.45" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.5" />
      <path d="M7.35 7.28H9.85M7.35 8.72H9.2M15.58 14.05H17.72M15.58 15.5H17.12M7.15 16.25H9.18" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.45" />
      <path d="M17.78 4.25L18.35 5.78L19.88 6.35L18.35 6.92L17.78 8.45L17.2 6.92L15.68 6.35L17.2 5.78L17.78 4.25Z" fill={color} fillOpacity="0.72" />
    </>,
    memoryShelf: <>
      <path d="M5.35 6.1C5.35 5.44 5.89 4.9 6.55 4.9H17.45C18.11 4.9 18.65 5.44 18.65 6.1V17.9C18.65 18.56 18.11 19.1 17.45 19.1H6.55C5.89 19.1 5.35 18.56 5.35 17.9V6.1Z" fill="none" stroke={color} strokeWidth={strokeSoft} />
      <path d="M8.05 8.05H10.6M8.05 10.25H12.25M8.05 12.45H11.35" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.58" />
      <path d="M14.75 8.05L15.28 9.42L16.65 9.95L15.28 10.48L14.75 11.85L14.22 10.48L12.85 9.95L14.22 9.42L14.75 8.05Z" fill={color} fillOpacity="0.7" />
      <path d="M7.65 15.35C9.35 14.45 10.95 14.12 12.45 14.35C13.95 14.58 15.27 14.25 16.4 13.35" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.72" />
      <path d="M8.15 16.98H15.85" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.36" />
    </>,
    fileText: <>
      <path d="M7 4.5H14.5L18 8V19.5C18 20.05 17.55 20.5 17 20.5H7C6.45 20.5 6 20.05 6 19.5V5.5C6 4.95 6.45 4.5 7 4.5Z" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinejoin="round"/>
      <path d="M14.5 4.5V8H18" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinejoin="round"/>
      <path d="M9 11.2H15" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.88"/>
      <path d="M9 14H14.2" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.72"/>
      <path d="M9 16.8H12.6" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.56"/>
    </>,
    filePlus: <>
      <path d="M7 4.5H14.5L18 8V19.5C18 20.05 17.55 20.5 17 20.5H7C6.45 20.5 6 20.05 6 19.5V5.5C6 4.95 6.45 4.5 7 4.5Z" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinejoin="round"/>
      <path d="M14.5 4.5V8H18" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinejoin="round"/>
      <line x1="12" y1="11" x2="12" y2="17" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round"/>
      <line x1="9" y1="14" x2="15" y2="14" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round"/>
    </>,
    openBook: <>
      <path
        d="M12 7.15C10.48 5.92 8.55 5.28 6.2 5.22C5.48 5.2 4.9 5.78 4.9 6.5V17.85C4.9 18.42 5.36 18.88 5.92 18.88C8.35 18.9 10.38 19.46 12 20.55"
        fill="none"
        stroke={color}
        strokeWidth={strokeSoft}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.15C13.28 5.9 15.2 5.24 17.78 5.18C18.5 5.16 19.1 5.74 19.1 6.46V17.58C19.1 18.14 18.66 18.6 18.1 18.62C15.52 18.72 13.48 19.36 12 20.55"
        fill="none"
        stroke={color}
        strokeWidth={strokeSoft}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.15V20.55"
        fill="none"
        stroke={color}
        strokeWidth={strokeDetail}
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        d="M7.2 8.6C8.6 8.72 9.75 9.05 10.62 9.6"
        fill="none"
        stroke={color}
        strokeWidth={strokeDetail}
        strokeLinecap="round"
        opacity="0.56"
      />
      <path
        d="M7.2 11.15C8.48 11.28 9.56 11.58 10.38 12.05"
        fill="none"
        stroke={color}
        strokeWidth={strokeDetail}
        strokeLinecap="round"
        opacity="0.42"
      />
      <path
        d="M17.05 8.15C15.56 8.36 14.38 8.82 13.5 9.55"
        fill="none"
        stroke={color}
        strokeWidth={strokeDetail}
        strokeLinecap="round"
        opacity="0.64"
      />
      <path
        d="M17.05 10.72C15.7 10.93 14.6 11.32 13.72 11.9"
        fill="none"
        stroke={color}
        strokeWidth={strokeDetail}
        strokeLinecap="round"
        opacity="0.46"
      />
      <path
        d="M17.05 13.22C15.86 13.42 14.86 13.74 14.05 14.2"
        fill="none"
        stroke={color}
        strokeWidth={strokeDetail}
        strokeLinecap="round"
        opacity="0.34"
      />
    </>,
    helpCircle: <>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke={color} strokeWidth={strokeSoft}/>
      <path d="M9.35 9.15C9.72 7.95 10.66 7.25 12.06 7.25C13.62 7.25 14.65 8.17 14.65 9.5C14.65 10.45 14.16 11.03 13.12 11.72C12.35 12.24 12.08 12.66 12.08 13.45" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round"/>
      <circle cx="12.05" cy="16.35" r="0.72" fill={color}/>
    </>,
    fontImport: <>
      <path d="M7.6 4.5H14.2L17.7 8V19.2C17.7 19.92 17.12 20.5 16.4 20.5H7.6C6.88 20.5 6.3 19.92 6.3 19.2V5.8C6.3 5.08 6.88 4.5 7.6 4.5Z" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinejoin="round"/>
      <path d="M14.2 4.5V7.35C14.2 7.78 14.55 8.12 14.98 8.12H17.7" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" strokeLinejoin="round" opacity="0.72"/>
      <path d="M8.65 15.75L10.85 9.95C11.08 9.36 11.92 9.36 12.15 9.95L14.35 15.75" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.65 13.35H13.35" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.76"/>
      <path d="M16.1 11.05V16.05" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round"/>
      <path d="M14.75 14.72L16.1 16.08L17.45 14.72" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" strokeLinejoin="round"/>
    </>,
    promptScript: <>
      <path d="M6.2 4.7H14.2L18.6 9.05V19.1C18.6 19.88 17.98 20.5 17.2 20.5H6.2C5.42 20.5 4.8 19.88 4.8 19.1V6.1C4.8 5.32 5.42 4.7 6.2 4.7Z" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinejoin="round"/>
      <path d="M14.2 4.7V8.05C14.2 8.52 14.58 8.9 15.05 8.9H18.6" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" strokeLinejoin="round" opacity="0.72"/>
      <path d="M7.75 10.8H14.8M7.75 13.5H16M7.75 16.2H12.6" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.78"/>
      <path d="M17.05 13.75L17.5 15.08L18.82 15.52L17.5 15.96L17.05 17.3L16.6 15.96L15.28 15.52L16.6 15.08L17.05 13.75Z" fill={color} fillOpacity="0.58"/>
    </>,
    promptMessage: <>
      <path d="M5.2 6.7C5.2 5.76 5.96 5 6.9 5H17.1C18.04 5 18.8 5.76 18.8 6.7V14.05C18.8 14.99 18.04 15.75 17.1 15.75H11.2L7.15 19V15.75H6.9C5.96 15.75 5.2 14.99 5.2 14.05V6.7Z" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinejoin="round"/>
      <path d="M8.1 8.9H15.9M8.1 11.45H13.7" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.78"/>
      <path d="M15.45 16.95L16.15 18.55L17.8 19.1L16.15 19.65L15.45 21.25L14.75 19.65L13.1 19.1L14.75 18.55L15.45 16.95Z" fill={color} fillOpacity="0.42"/>
    </>,
    promptTone: <>
      <path d="M4.6 13.2C5.55 10.7 6.72 9.45 8.1 9.45C10.42 9.45 10.42 17.2 12.72 17.2C14.16 17.2 15.32 15.08 16.48 10.85C17.08 8.68 17.88 7.6 18.9 7.6" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round"/>
      <path d="M5.2 7.2H5.22M8.4 5.8H8.42M11.6 6.55H11.62M14.8 5.4H14.82" fill="none" stroke={color} strokeWidth={strokeBold} strokeLinecap="round" opacity="0.6"/>
      <path d="M6.8 18.9H18.1" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.28"/>
    </>,
    promptRules: <>
      <path d="M5.2 6.7H9.05C10.16 6.7 11.05 7.6 11.05 8.7V15.3C11.05 16.4 11.94 17.3 13.05 17.3H18.8" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round"/>
      <path d="M5.2 17.3H8.05C9.15 17.3 10.05 16.4 10.05 15.3V8.7C10.05 7.6 10.95 6.7 12.05 6.7H18.8" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" opacity="0.42"/>
      <circle cx="5.2" cy="6.7" r="1.35" fill="none" stroke={color} strokeWidth={strokeDetail}/>
      <circle cx="5.2" cy="17.3" r="1.35" fill="none" stroke={color} strokeWidth={strokeDetail} opacity="0.58"/>
      <path d="M18.8 4.75L19.48 6.02L20.85 6.7L19.48 7.38L18.8 8.65L18.12 7.38L16.75 6.7L18.12 6.02L18.8 4.75Z" fill={color} fillOpacity="0.68"/>
      <path d="M18.8 15.35L19.48 16.62L20.85 17.3L19.48 17.98L18.8 19.25L18.12 17.98L16.75 17.3L18.12 16.62L18.8 15.35Z" fill={color} fillOpacity="0.5"/>
    </>,
    inbox: <>
      <path d="M4.5 14L7.2 14C7.7 14 8.15 14.3 8.35 14.75L9.15 16.5C9.35 16.95 9.8 17.25 10.3 17.25H13.7C14.2 17.25 14.65 16.95 14.85 16.5L15.65 14.75C15.85 14.3 16.3 14 16.8 14H19.5" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.5 6.5H18.5C19.05 6.5 19.5 6.95 19.5 7.5V18.5C19.5 19.05 19.05 19.5 18.5 19.5H5.5C4.95 19.5 4.5 19.05 4.5 18.5V7.5C4.5 6.95 4.95 6.5 5.5 6.5Z" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinejoin="round"/>
    </>,
    feather: <>
      <path d="M18 3.5C14.5 4 12 7 10.5 10C9 13 7.5 16 5 20" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 3.5C16 5 14.5 7 13.5 8.5" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.72"/>
      <path d="M17.5 5.5C15 6.5 13 8 11.5 10.5" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.55"/>
      <path d="M15.5 8C13.5 9 11.5 11 10.5 13" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.42"/>
      <path d="M13 11C11.5 12.5 10 14.5 8.5 16.5" fill="none" stroke={color} strokeWidth={strokeDetail} strokeLinecap="round" opacity="0.32"/>
    </>,
    zap: <>
      <polygon points="13,2 6,14 11,14 10,22 18,10 13,10 14,2" fill="none" stroke={color} strokeWidth={strokeSoft} strokeLinejoin="round"/>
    </>,
    compass: <>
      <circle cx="12" cy="12" r="8" fill="none" stroke={color} strokeWidth={strokeSoft}/>
      <polygon points="10,14 7,17 10.5,10.5" fill={color} fillOpacity="0.72"/>
      <polygon points="14,10 17,7 13.5,13.5" fill={color} fillOpacity="0.72"/>
      <polygon points="10,10 10.5,10.5 13.5,13.5 14,14" fill={color} fillOpacity="0.28"/>
      <polygon points="10,14 10.5,10.5 7,7" fill={color} fillOpacity="0.28"/>
    </>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0, transformBox: 'view-box', transformOrigin: 'center' }}
    >
      {icons[name]}
    </svg>
  );
}
