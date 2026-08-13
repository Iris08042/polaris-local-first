import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { MenuOverlayPage } from '../../app/shell/appShellContracts';
import {
  fetchHeartbeatPolicy,
  HEARTBEAT_POLICY_CHANGED_EVENT
} from '../../app/heartbeat/heartbeatPolicyClient';
import { HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT } from '../../app/heartbeat/heartbeatInboxSettings';
import { relationshipDays } from '../../app/endlessSummer/relationshipDays';
import { canCheckAndroidApkUpdate } from '../../app/android/androidApkUpdateRuntime';
import { getDesktopLocalHostBridge } from '../../desktop/localHost';
import { saveAsset } from '../../infrastructure/assetStore';
import type { AppCustomization, CollectionShelf, World } from '../../types/domain';
import { Icon, type IconName } from '../Icon';
import { AppTopbar, type AppTopbarProps } from '../shell/AppTopbar';
import type { DesktopAppSidebarProps } from '../app-shell/DesktopAppSidebar';
import { useAssetObjectUrl } from '../useAssetObjectUrl';

type PrimaryPage = 'chat' | 'memory' | 'home' | 'features' | 'settings' | 'collection' | 'legacy';
type CollectionParentPage = 'memory' | 'features' | 'settings';
type MobileConversationNavigation = Omit<DesktopAppSidebarProps, 'collapsed' | 'onToggleCollapsed'>;

export type EndlessSummerShellProps = {
  activeWorld: World;
  worldStack: ReactNode;
  topbarProps: AppTopbarProps;
  conversations: MobileConversationNavigation;
  collaboratorName: string;
  userName: string;
  collectionShelf: CollectionShelf;
  customization: AppCustomization;
  setCustomization: (patch: Partial<AppCustomization>) => void;
  onOpenChat: () => void;
  onOpenCollectionShelf: (shelf: CollectionShelf) => void;
  onOpenGroup: () => void;
  onCloseCollectionScope: () => void;
  onOpenSettingsPage: (page: MenuOverlayPage) => void;
  onOpenProviderSettings: () => void;
};

const NAV_ITEMS: Array<{ page: Exclude<PrimaryPage, 'legacy'>; label: string }> = [
  { page: 'chat', label: '聊天' },
  { page: 'memory', label: '记忆' },
  { page: 'home', label: '小窝' },
  { page: 'features', label: '功能' },
  { page: 'settings', label: '设置' }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function NavIcon({ page }: { page: Exclude<PrimaryPage, 'legacy'> }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {page === 'chat' ? <path d="M5 6.5h22v15H14l-6.5 5v-5H5z" /> : null}
      {page === 'memory' ? <><path d="M7 5.5h15.5A2.5 2.5 0 0 1 25 8v18H9a2 2 0 0 1-2-2z" /><path d="M12 5.5V26M16 10h5" /></> : null}
      {page === 'home' ? <><path d="M4.5 15.5 16 5l11.5 10.5" /><path d="M7.5 14v12h17V14M13 26v-7h6v7" /></> : null}
      {page === 'features' ? <><rect x="5" y="5" width="8" height="8" rx="2" /><rect x="19" y="5" width="8" height="8" rx="2" /><rect x="5" y="19" width="8" height="8" rx="2" /><rect x="19" y="19" width="8" height="8" rx="2" /></> : null}
      {page === 'settings' ? <><circle cx="16" cy="10" r="5" /><path d="M6.5 27c.8-6 4-9 9.5-9s8.7 3 9.5 9" /></> : null}
    </svg>
  );
}

function Flower({ className = '' }: { className?: string }) {
  return <span className={`es-flower ${className}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>;
}

function useHeartbeatMode() {
  const [mode, setMode] = useState('状态未知');
  const [known, setKnown] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const snapshot = await fetchHeartbeatPolicy();
        if (!cancelled) {
          setMode(snapshot.active.profileName?.trim() || '状态未知');
          setKnown(Boolean(snapshot.active.profileName?.trim()));
          setEnabled(snapshot.policy.enabled);
        }
      } catch {
        if (!cancelled) {
          setMode('状态未知');
          setKnown(false);
        }
      }
    };
    void load();
    window.addEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, load);
    window.addEventListener(HEARTBEAT_POLICY_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, load);
      window.removeEventListener(HEARTBEAT_POLICY_CHANGED_EVENT, load);
    };
  }, []);

  return { mode, known, enabled };
}

function ScreenHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="es-screen-heading">
      <Flower />
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

function HubCard({
  icon,
  title,
  detail,
  onClick,
  disabled = false,
  className = ''
}: {
  icon: IconName;
  title: string;
  detail: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`es-hub-card ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} size={28} />
      <span><strong>{title}</strong><small>{detail}</small></span>
      {disabled ? <em>暂未开放</em> : <span className="es-chevron">›</span>}
    </button>
  );
}

function CouplePhoto({
  customization,
  setCustomization,
  onRequestUpload
}: Pick<EndlessSummerShellProps, 'customization' | 'setCustomization'> & { onRequestUpload: () => void }) {
  const imageUrl = useAssetObjectUrl(customization.coupleImageAssetId ?? undefined);
  const positionY = customization.coupleImagePositionY ?? 50;
  const [position, setPosition] = useState({
    x: customization.coupleImagePositionX ?? 50,
    y: positionY
  });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    setPosition({
      x: customization.coupleImagePositionX ?? 50,
      y: positionY
    });
  }, [customization.coupleImagePositionX, positionY]);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!imageUrl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: position.x,
      startY: position.y
    };
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: clamp(drag.startX + ((drag.x - event.clientX) / rect.width) * 100, 0, 100),
      y: clamp(drag.startY + ((drag.y - event.clientY) / rect.height) * 100, 0, 100)
    });
  };
  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setCustomization({ coupleImagePositionX: position.x, coupleImagePositionY: position.y });
  };

  return (
    <div className="es-couple-collage">
      <div
        className={`es-couple-photo ${imageUrl ? 'has-image' : ''}`}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="小窝双人图"
            draggable={false}
            style={{
              objectPosition: `${position.x}% ${position.y}%`,
              transform: `scale(${customization.coupleImageScale ?? 1})`
            }}
          />
        ) : (
          <button type="button" className="es-photo-placeholder" onClick={onRequestUpload}>
            <Icon name="image" size={25} />
            <span>放入我们的照片</span>
          </button>
        )}
      </div>
    </div>
  );
}

function HomePage({
  customization,
  setCustomization,
  onChooseImage,
  onOpenSettings
}: Pick<EndlessSummerShellProps, 'customization' | 'setCustomization'> & { onChooseImage: () => void; onOpenSettings: () => void }) {
  const days = relationshipDays(customization.relationshipStartDate ?? '');
  return (
    <section className="es-page es-home-page" aria-label="小窝">
      <CouplePhoto customization={customization} setCustomization={setCustomization} onRequestUpload={onChooseImage} />
      <article className="es-welcome-card">
        <Flower className="es-welcome-flower" />
        <p>欢迎回家，清瑶</p>
        <span>我们在一起</span>
        {days === null ? <button type="button" onClick={onOpenSettings}>设置纪念日</button> : <strong><b>{days}</b> 天</strong>}
        <div className="es-card-hydrangea" aria-hidden="true" />
      </article>
    </section>
  );
}

function MemoryPage({ onOpenCollectionShelf, onOpenSettingsPage }: Pick<EndlessSummerShellProps, 'onOpenCollectionShelf' | 'onOpenSettingsPage'>) {
  return (
    <section className="es-page es-scroll-page">
      <ScreenHeading title="记忆" subtitle="我们记得的事" />
      <button type="button" className="es-ob-card" onClick={() => onOpenSettingsPage('memory')}>
        <span><strong>长期记忆 · OB</strong><small><i />未连接 · 连接后显示长期记忆</small></span><b>›</b>
      </button>
      <div className="es-memory-grid">
        <HubCard icon="memoryMap" title="动态记忆" detail="我们现在的状态" disabled />
        <HubCard icon="layers" title="滚动摘要" detail="最近这段时间" disabled />
        <HubCard icon="openBook" title="原始档案" detail="完整聊天记录" onClick={() => onOpenCollectionShelf('dialogue')} />
        <HubCard icon="fileText" title="长期资料" detail="设定与重要内容" onClick={() => onOpenCollectionShelf('info')} />
      </div>
      <button type="button" className="es-search-memory" onClick={() => onOpenSettingsPage('memory')}>
        <Icon name="search" size={22} />搜索记忆
      </button>
    </section>
  );
}

function FeaturesPage({
  onOpenSettingsPage,
  onOpenCollectionShelf,
  onOpenGroup
}: Pick<EndlessSummerShellProps, 'onOpenSettingsPage' | 'onOpenCollectionShelf' | 'onOpenGroup'>) {
  const heartbeat = useHeartbeatMode();
  return (
    <section className="es-page es-scroll-page">
      <ScreenHeading title="功能" subtitle="我们可以一起做的事" />
      <button type="button" className="es-feature-hero" onClick={() => onOpenSettingsPage('automation')}>
        <Flower />
        <span><strong>主动联系</strong><small>频率、时段与消息回流</small><em>{heartbeat.known ? heartbeat.enabled ? `当前 · ${heartbeat.mode}` : '主动消息已暂停' : '状态未知'}</em></span>
        <Icon name="send" size={46} />
        <b>›</b>
      </button>
      <div className="es-feature-grid">
        <HubCard icon="cardStack" title="收藏与资料" detail="图片、文件和卡片" onClick={() => onOpenCollectionShelf('project')} />
        <HubCard icon="navGroup" title="协作者与群聊" detail="共同空间" onClick={onOpenGroup} />
        <HubCard icon="mcpService" title="外部工具" detail="MCP 与扩展能力" onClick={() => onOpenSettingsPage('mcp')} />
      </div>
      <h2 className="es-future-title">以后一起玩</h2>
      <HubCard icon="task" title="小游戏" detail="慢慢把喜欢的搬进来" disabled className="es-future-card" />
    </section>
  );
}

const COLLECTION_TABS: Record<CollectionParentPage, Array<{ shelf: CollectionShelf; label: string }>> = {
  features: [
    { shelf: 'project', label: '文件' },
    { shelf: 'code', label: '卡片' },
    { shelf: 'image', label: '图片' }
  ],
  memory: [
    { shelf: 'dialogue', label: '原始档案' },
    { shelf: 'info', label: '长期资料' }
  ],
  settings: [
    { shelf: 'info', label: '角色资料' }
  ]
};

function CollectionPage({
  parentPage,
  activeShelf,
  worldStack,
  onBack,
  onSelectShelf
}: {
  parentPage: CollectionParentPage;
  activeShelf: CollectionShelf;
  worldStack: ReactNode;
  onBack: () => void;
  onSelectShelf: (shelf: CollectionShelf) => void;
}) {
  const tabs = COLLECTION_TABS[parentPage];
  const title = parentPage === 'memory' ? '记忆资料' : parentPage === 'settings' ? '角色资料' : '收藏与资料';
  const subtitle = parentPage === 'memory' ? '叶明舟记得的原始内容' : parentPage === 'settings' ? '角色设定与长期信息' : '图片、文件和卡片都在这里';

  return (
    <section className="es-collection-page" aria-label={title}>
      <header className="es-collection-header">
        <button type="button" onClick={onBack} aria-label={`返回${parentPage === 'features' ? '功能' : parentPage === 'memory' ? '记忆' : '设置'}`}>‹</button>
        <div><h1>{title}</h1><p>{subtitle}</p></div>
        <Flower />
      </header>
      <nav className="es-collection-tabs" aria-label={`${title}分类`}>
        {tabs.map((tab) => (
          <button
            type="button"
            className={activeShelf === tab.shelf ? 'active' : ''}
            onClick={() => onSelectShelf(tab.shelf)}
            key={tab.shelf}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="es-world-slot es-collection-world-slot">{worldStack}</div>
    </section>
  );
}

function SettingsRow({ icon, title, detail, onClick }: { icon: IconName; title: string; detail: string; onClick: () => void }) {
  return <HubCard icon={icon} title={title} detail={detail} onClick={onClick} className="es-settings-row" />;
}

function todayInputValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function SettingsPage({
  collaboratorName,
  customization,
  setCustomization,
  onChooseImage,
  onOpenCollectionShelf,
  onOpenSettingsPage,
  onOpenProviderSettings
}: Pick<EndlessSummerShellProps, 'collaboratorName' | 'customization' | 'setCustomization' | 'onOpenCollectionShelf' | 'onOpenSettingsPage' | 'onOpenProviderSettings'> & { onChooseImage: () => void }) {
  return (
    <section className="es-page es-scroll-page es-settings-page">
      <ScreenHeading title="设置" subtitle="把这里变成我们的样子" />
      <h2>常用设置</h2>
      <div className="es-settings-group">
        <SettingsRow icon="brush" title="外观与主题" detail="背景、字体与气泡" onClick={() => onOpenSettingsPage('display')} />
        <SettingsRow icon="fontImport" title="字体设置" detail="字体导入与显示大小" onClick={() => onOpenSettingsPage('fonts')} />
        <SettingsRow icon="compass" title="界面语言" detail="简体中文与 English" onClick={() => onOpenSettingsPage('language')} />
        <details className="es-home-settings">
          <summary><Icon name="lighthouse" size={27} /><span><strong>小窝设置</strong><small>双人图与在一起日期</small></span><b>›</b></summary>
          <div className="es-home-settings-fields">
            <button type="button" onClick={onChooseImage}><Icon name="image" size={18} />更换双人图</button>
            <label><span>在一起日期</span><input type="date" max={todayInputValue()} value={customization.relationshipStartDate ?? ''} onInput={(event) => setCustomization({ relationshipStartDate: event.currentTarget.value })} /></label>
            <label><span>照片缩放</span><input type="range" min="1" max="2.4" step="0.05" value={customization.coupleImageScale ?? 1} onChange={(event) => setCustomization({ coupleImageScale: Number(event.target.value) })} /></label>
            <p>在小窝里直接拖动照片，可以调整画面位置；花框不会跟着照片移动。</p>
          </div>
        </details>
        <SettingsRow icon="persona" title={`${collaboratorName || '协作者'}与你`} detail="角色设定与用户设定" onClick={() => onOpenCollectionShelf('info')} />
      </div>
      <h2>连接与能力</h2>
      <div className="es-settings-group">
        <SettingsRow icon="providerRoute" title="模型与线路" detail="当前模型与服务" onClick={onOpenProviderSettings} />
        <SettingsRow icon="lighthouse" title="请求入口" detail="Polaris 或自建中转" onClick={() => onOpenSettingsPage('gateway')} />
        <SettingsRow icon="mcpServer" title="工具与权限" detail="MCP 与协作者权限" onClick={() => onOpenSettingsPage('toolbox')} />
        <SettingsRow icon="mcpService" title="MCP 服务" detail="外部工具服务管理" onClick={() => onOpenSettingsPage('mcp')} />
        <SettingsRow icon="image" title="生图设置" detail="配置画图模型线路" onClick={() => onOpenSettingsPage('generation')} />
        <SettingsRow icon="voice" title="语音设置" detail="配置回答朗读接口" onClick={() => onOpenSettingsPage('voice')} />
        {getDesktopLocalHostBridge() ? <SettingsRow icon="folder" title="本机环境" detail="文件夹、命令行与权限模式" onClick={() => onOpenSettingsPage('desktopLocal')} /> : null}
        <SettingsRow icon="inbox" title="主动联系设置" detail="通知与消息回流" onClick={() => onOpenSettingsPage('automation')} />
      </div>
      <h2>数据</h2>
      <div className="es-settings-group">
        <SettingsRow icon="infoCard" title="用量统计" detail="回复与 Token 使用情况" onClick={() => onOpenSettingsPage('usage')} />
        <SettingsRow icon="search" title="存储体检" detail="空间占用与本地维护" onClick={() => onOpenSettingsPage('storage')} />
        <SettingsRow icon="download" title="导入、导出与备份" detail="迁移与保管本地数据" onClick={() => onOpenSettingsPage('backup')} />
        <SettingsRow icon="infoCard" title="隐私说明" detail="本地数据与外部服务" onClick={() => onOpenSettingsPage('privacy')} />
        <SettingsRow icon="infoCard" title="关于无尽夏" detail="产品说明与隐私" onClick={() => onOpenSettingsPage('docs')} />
        {canCheckAndroidApkUpdate() ? <SettingsRow icon="download" title="系统更新" detail="检查 Android 安装包更新" onClick={() => onOpenSettingsPage('system')} /> : null}
      </div>
    </section>
  );
}

function ChatHeader({ collaboratorName, onOpenDrawer, onOpenSettings, onOpenSettingsPage }: Pick<EndlessSummerShellProps, 'collaboratorName' | 'onOpenSettingsPage'> & { onOpenDrawer: () => void; onOpenSettings: () => void }) {
  const heartbeat = useHeartbeatMode();
  return (
    <header className="es-chat-header">
      <button type="button" onClick={onOpenDrawer} aria-label="打开聊天列表"><span /><span /><span /></button>
      <div><strong>{collaboratorName || '当前聊天'}</strong><small>当前主聊天</small><button type="button" onClick={() => onOpenSettingsPage('automation')}>{heartbeat.known && !heartbeat.enabled ? '主动消息已暂停' : `主动 · ${heartbeat.mode}`}</button></div>
      <button type="button" onClick={onOpenSettings} aria-label="聊天设置"><i>•••</i></button>
      <Flower className="es-chat-flower-one" /><Flower className="es-chat-flower-two" />
    </header>
  );
}

function ConversationDrawer({ navigation, onClose, onOpen }: { navigation: MobileConversationNavigation; onClose: () => void; onOpen: () => void }) {
  const [query, setQuery] = useState('');
  const conversations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return [...navigation.conversations]
      .filter((conversation) => !normalized || conversation.displayTitle.toLocaleLowerCase().includes(normalized) || conversation.latestExcerpt.toLocaleLowerCase().includes(normalized))
      .sort((left, right) => (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0) || right.updatedAt - left.updatedAt);
  }, [navigation.conversations, query]);

  return (
    <div className="es-drawer-backdrop" onClick={onClose}>
      <aside className="es-conversation-drawer" onClick={(event) => event.stopPropagation()} aria-label="聊天列表">
        <header>
          <div><small>聊天</small><h2>和 {navigation.currentCollaborator?.name || '协作者'} 的对话</h2></div>
          <div className="es-drawer-head-actions">
            <button type="button" className="es-drawer-create" aria-label="新建聊天" onClick={() => {
              if (!window.confirm('新建一段聊天？当前聊天会保留在列表中。')) return;
              navigation.onCreateConversation();
              onOpen();
            }}>＋</button>
            <button type="button" onClick={onClose} aria-label="关闭聊天列表">×</button>
          </div>
        </header>
        <label className="es-drawer-search"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索聊天" /></label>
        <div className="es-drawer-list">
          {conversations.map((conversation) => (
            <article className={conversation.id === navigation.activeConversationId ? 'active' : ''} key={conversation.id}>
              <button type="button" onClick={() => { navigation.onOpenConversation(conversation.id); onOpen(); }}>
                <strong>{conversation.displayTitle}</strong><small>{conversation.latestExcerpt}</small>
              </button>
              <button type="button" className="es-thread-more" aria-label="聊天操作" onClick={() => {
                const action = window.prompt('输入 r 重命名，p 置顶/取消置顶，d 删除', '');
                if (action?.toLowerCase() === 'r') {
                  const title = window.prompt('新的聊天名称', conversation.displayTitle);
                  if (title?.trim()) navigation.onRenameConversation(conversation.id, title.trim());
                } else if (action?.toLowerCase() === 'p') {
                  navigation.onToggleConversationPinned(conversation.id);
                } else if (action?.toLowerCase() === 'd') {
                  navigation.onDeleteConversation(conversation.id, conversation.displayTitle);
                }
              }}>•••</button>
            </article>
          ))}
          {conversations.length === 0 ? <p>没有找到聊天</p> : null}
        </div>
      </aside>
    </div>
  );
}

export function EndlessSummerShell(props: EndlessSummerShellProps) {
  const [page, setPage] = useState<PrimaryPage>('home');
  const [collectionParentPage, setCollectionParentPage] = useState<CollectionParentPage>('features');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousWorldRef = useRef(props.activeWorld);

  useEffect(() => {
    if (previousWorldRef.current === props.activeWorld) return;
    const previousWorld = previousWorldRef.current;
    previousWorldRef.current = props.activeWorld;
    if (previousWorld === 'group' && props.activeWorld === 'collection') {
      props.onCloseCollectionScope();
      setPage('features');
      return;
    }
    setPage(props.activeWorld === 'chat' ? 'chat' : props.activeWorld === 'collection' ? 'collection' : 'legacy');
  }, [props.activeWorld]);

  const chooseImage = () => fileInputRef.current?.click();
  const importImage = async (file: File | undefined) => {
    if (!file) return;
    setUploadError('');
    try {
      const asset = await saveAsset({ kind: 'image', name: file.name || '小窝双人图', mimeType: file.type || 'image/jpeg', blob: file });
      props.setCustomization({ coupleImageAssetId: asset.id, coupleImagePositionX: 50, coupleImagePositionY: 50, coupleImageScale: 1 });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '照片保存失败');
    }
  };
  const openCollectionShelf = (shelf: CollectionShelf, parentPage: CollectionParentPage) => {
    setCollectionParentPage(parentPage);
    props.onOpenCollectionShelf(shelf);
    setPage('collection');
  };
  const openLegacyGroup = () => {
    props.onCloseCollectionScope();
    props.onOpenGroup();
    setPage('legacy');
  };
  const navigate = (next: Exclude<PrimaryPage, 'legacy'>) => {
    if (next === 'chat') props.onOpenChat();
    setPage(next);
  };
  const selectedNavPage = page === 'legacy'
    ? (props.activeWorld === 'chat' ? 'chat' : 'features')
    : page === 'collection' ? collectionParentPage : page;

  return (
    <div className={`es-shell es-page-${selectedNavPage}`}>
      <input ref={fileInputRef} className="es-hidden-input" type="file" accept="image/*" onChange={(event) => { void importImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      {page === 'chat' ? (
        <><ChatHeader collaboratorName={props.collaboratorName} onOpenDrawer={() => setDrawerOpen(true)} onOpenSettings={() => setPage('settings')} onOpenSettingsPage={props.onOpenSettingsPage} /><div className="es-world-slot">{props.worldStack}</div></>
      ) : null}
      {page === 'legacy' ? <><AppTopbar {...props.topbarProps} /><div className="es-world-slot">{props.worldStack}</div></> : null}
      {page === 'collection' ? (
        <CollectionPage
          parentPage={collectionParentPage}
          activeShelf={props.collectionShelf}
          worldStack={props.worldStack}
          onBack={() => setPage(collectionParentPage)}
          onSelectShelf={(shelf) => props.onOpenCollectionShelf(shelf)}
        />
      ) : null}
      {page === 'home' ? <HomePage customization={props.customization} setCustomization={props.setCustomization} onChooseImage={chooseImage} onOpenSettings={() => navigate('settings')} /> : null}
      {page === 'memory' ? <MemoryPage onOpenCollectionShelf={(shelf) => openCollectionShelf(shelf, 'memory')} onOpenSettingsPage={props.onOpenSettingsPage} /> : null}
      {page === 'features' ? <FeaturesPage onOpenSettingsPage={props.onOpenSettingsPage} onOpenCollectionShelf={(shelf) => openCollectionShelf(shelf, 'features')} onOpenGroup={openLegacyGroup} /> : null}
      {page === 'settings' ? <SettingsPage collaboratorName={props.collaboratorName} customization={props.customization} setCustomization={props.setCustomization} onChooseImage={chooseImage} onOpenCollectionShelf={(shelf) => openCollectionShelf(shelf, 'settings')} onOpenSettingsPage={props.onOpenSettingsPage} onOpenProviderSettings={props.onOpenProviderSettings} /> : null}
      {uploadError ? <p className="es-upload-error" role="alert">{uploadError}</p> : null}
      <nav className="es-primary-nav" aria-label="一级导航">
        {NAV_ITEMS.map((item) => (
          <button type="button" className={selectedNavPage === item.page ? 'active' : ''} onClick={() => navigate(item.page)} key={item.page}>
            <span><NavIcon page={item.page} /></span><small>{item.label}</small>
          </button>
        ))}
      </nav>
      {drawerOpen ? <ConversationDrawer navigation={props.conversations} onClose={() => setDrawerOpen(false)} onOpen={() => { setDrawerOpen(false); setPage('chat'); }} /> : null}
    </div>
  );
}
