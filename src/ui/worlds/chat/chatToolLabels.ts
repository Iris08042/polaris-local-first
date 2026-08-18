import type { ToolInvocation } from '../../../types/domain';
import type { I18nTranslator } from '../../../i18n';
import { MANAGED_SCHEDULED_MESSAGE_MCP_SERVER_ID } from '../../../app/scheduled-message/managedScheduledMessageMcp';

type ToolLabelKey = Parameters<I18nTranslator['t']>[0];
type ToolLabelValues = Parameters<I18nTranslator['t']>[1];
type ToolLabelTranslator = I18nTranslator['t'];

function scheduledMessageReceipt(tool: ToolInvocation) {
  if (tool.mcpResult?.serverId !== MANAGED_SCHEDULED_MESSAGE_MCP_SERVER_ID) return '';
  const result = tool.mcpResult.structuredContent;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return '';
  const receipt = (result as Record<string, unknown>).receipt;
  return typeof receipt === 'string' ? receipt.trim() : '';
}

function localizeToolLabel(
  t: ToolLabelTranslator | undefined,
  key: ToolLabelKey,
  fallback: string,
  values?: ToolLabelValues
) {
  return t ? t(key, values) : fallback;
}

export function toolStatusLabel(status: ToolInvocation['status'], t?: ToolLabelTranslator): string {
  switch (status) {
    case 'running':
      return localizeToolLabel(t, 'chat.toolEvent.status.running', '执行中');
    case 'preview':
      return localizeToolLabel(t, 'chat.toolEvent.status.preview', '试穿中');
    case 'applied':
      return localizeToolLabel(t, 'chat.toolEvent.status.applied', '已应用');
    case 'rolled_back':
      return localizeToolLabel(t, 'chat.toolEvent.status.rolledBack', '已回滚');
    case 'superseded':
      return localizeToolLabel(t, 'chat.toolEvent.status.superseded', '已替换');
    case 'executed':
      return localizeToolLabel(t, 'chat.toolEvent.status.executed', '已执行');
    case 'saved':
      return localizeToolLabel(t, 'chat.toolEvent.status.saved', '已保存');
    case 'failed':
      return localizeToolLabel(t, 'chat.toolEvent.status.failed', '执行失败');
    default:
      return status;
  }
}

export function toolEventCopy(tool: ToolInvocation, t?: ToolLabelTranslator) {
  if (tool.detailText?.trim()) {
    return tool.detailText;
  }
  const batchLabels = tool.themeBatchLabels?.slice(0, 3) ?? [];
  const joinedBatchLabels = batchLabels.join(t ? ', ' : '、');
  const batchLabelSummary = batchLabels.length
    ? (tool.themeBatchLabels?.length ?? 0) > batchLabels.length
      ? localizeToolLabel(t, 'chat.toolEvent.batchLabelsMore', `${joinedBatchLabels}等`, { labels: joinedBatchLabels })
      : joinedBatchLabels
    : localizeToolLabel(t, 'chat.toolEvent.batchCount', `${tool.themeBatchCount ?? 0} 处界面改动`, { count: tool.themeBatchCount ?? 0 });
  const themeScopeCopy =
    tool.themeScope === 'collection'
      ? localizeToolLabel(t, 'chat.toolEvent.scope.collection', '这版主要落在房间。')
      : tool.themeScope === 'chat'
        ? localizeToolLabel(t, 'chat.toolEvent.scope.chat', '这版主要落在对话区。')
        : localizeToolLabel(t, 'chat.toolEvent.scope.default', '试穿已经备好。');
  if (tool.status === 'running') {
    return localizeToolLabel(t, 'chat.toolEvent.runningDetail', '工具正在处理中，会在同一条对话流里继续返回结果。');
  }
  if (tool.status === 'preview') {
    if (tool.kind === 'writeMemory') {
      return localizeToolLabel(t, 'chat.toolEvent.previewMemory', '这批记忆暂未写入，确认后才会进入当前协作者的长期记忆。');
    }
    if (tool.kind === 'writeMemoryDoc') {
      return localizeToolLabel(t, 'chat.toolEvent.previewMemoryDoc', '这份长期资料暂未写入，确认后才会进入当前协作者的资料库。');
    }
    if ((tool.themeBatchCount ?? 0) > 1) {
      return localizeToolLabel(
        t,
        'chat.toolEvent.previewThemeBatch',
        `${themeScopeCopy} 这轮会一起试穿 ${batchLabelSummary}。可应用这版，或取消这次试穿。`,
        { scope: themeScopeCopy, batch: batchLabelSummary }
      );
    }
    return localizeToolLabel(
      t,
      'chat.toolEvent.previewThemeSingle',
      `${themeScopeCopy} 可应用这版，或取消这次试穿。`,
      { scope: themeScopeCopy }
    );
  }
  if (tool.status === 'applied') {
    if (tool.kind === 'writeMemory') {
      return localizeToolLabel(t, 'chat.toolEvent.appliedMemory', '已确认写入，后面对话会把这批记忆当长期偏好来参考。');
    }
    if (tool.kind === 'writeMemoryDoc') {
      return localizeToolLabel(t, 'chat.toolEvent.appliedMemoryDoc', '已确认写入，后面对话可以按需读取这份长期资料全文。');
    }
    const appliedScopeCopy = tool.themeScope === 'collection'
      ? localizeToolLabel(t, 'chat.toolEvent.appliedTheme.collection', '房间这版改动已保留。')
      : tool.themeScope === 'chat'
        ? localizeToolLabel(t, 'chat.toolEvent.appliedTheme.chat', '对话区这版改动已保留。')
        : localizeToolLabel(t, 'chat.toolEvent.appliedTheme.default', '这一版改动已保留。');
    return localizeToolLabel(
      t,
      'chat.toolEvent.appliedThemeSuffix',
      `${appliedScopeCopy} 并记入 Theme Studio 历史。`,
      { scope: appliedScopeCopy }
    );
  }
  if (tool.kind === 'createRoomProject' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.navigation.workspace', '去工作区继续看、改或运行。');
  }
  if ((
    tool.kind === 'createProjectFile'
    || tool.kind === 'patchRoomProject'
    || tool.kind === 'promoteCardToProject'
    || tool.kind === 'appendProjectFile'
    || tool.kind === 'replaceProjectFileLines'
    || tool.kind === 'editProjectFileText'
    || tool.kind === 'deleteProjectFile'
    || tool.kind === 'readProjectFile'
    || tool.kind === 'readProjectFileContext'
  ) && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.navigation.workspace', '去工作区继续看、改或运行。');
  }
  if (tool.kind === 'createCodeCard' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.codeCardCreated', '卡片已经收进房间，也可以直接在这里展开。');
  }
  if ((tool.kind === 'patchCodeCard' || tool.kind === 'appendCodeCard' || tool.kind === 'editCodeCardText') && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.codeCardUpdated', '卡片已经更新，可以直接在这里展开。');
  }
  if (tool.kind === 'saveAttachmentAsCodeCard' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.attachmentSaved', '附件已经变成卡片，也收进房间了。');
  }
  if (tool.kind === 'saveArchiveEntryAsCodeCard' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.archiveEntrySaved', '压缩包里的文件已经变成卡片，也收进房间了。');
  }
  if (tool.kind === 'webSearch' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.webSearchDone', '已经联网把结果捞回来了，下面这段就是这轮搜索到的网页摘要。');
  }
  if (tool.kind === 'readWebPage' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.webPageRead', '网页正文已经读回来了，下面这段是本轮抓到的主要内容。');
  }
  if (tool.kind === 'bundleArchiveEntries' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.archiveBundled', '已经按你选的包内文件重新打了一个 zip，下载附件里这份新压缩包就行。');
  }
  if (tool.kind === 'saveAttachmentToCollection' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.imageSaved', '这张图已经收进图片收藏卡了，可以回到房间继续看。');
  }
  if (tool.kind === 'writeMemory' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.memoryWritten', '这条偏好已经写进当前协作者记忆，后面对话会自然参考。');
  }
  if (tool.kind === 'writeMemoryDoc' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.memoryDocWritten', '这份长期资料已经写进当前协作者资料库，后面对话可以按需读取全文。');
  }
  if (tool.kind === 'startTask' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.taskStarted', '任务已经立起来了，接下来会在同一个执行状态里继续推进。');
  }
  if (tool.kind === 'completeTask' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.taskCompleted', '任务已经收尾，当前执行状态已完成。');
  }
  if (tool.kind === 'invokeCodeCardTool' && tool.status === 'executed') {
    return localizeToolLabel(t, 'chat.toolEvent.codeCardToolRan', '这张工具卡已经跑完了，下面这段就是它这次返回的结果。');
  }
  if (tool.status === 'saved') {
    return localizeToolLabel(t, 'chat.toolEvent.saved', '已存入卡片，可以直接在这里展开，或打开去房间细改。');
  }
  if (tool.status === 'rolled_back') {
    return localizeToolLabel(t, 'chat.toolEvent.rolledBack', '这次试穿已取消，界面已经回到之前的样子。');
  }
  if (tool.status === 'superseded') {
    return localizeToolLabel(t, 'chat.toolEvent.superseded', '这版试穿已经被后续版本顶替，界面现在显示的是更新后的那一版。');
  }
  if (tool.status === 'failed') {
    return tool.error ?? tool.summary;
  }
  return tool.summary;
}

export function compactToolEventSummary(tool: ToolInvocation, t?: ToolLabelTranslator) {
  const scheduledReceipt = scheduledMessageReceipt(tool);
  if (scheduledReceipt) return scheduledReceipt;
  const title = tool.title.trim();
  const summary = tool.summary.trim();
  const titleWithSummary = (fallback: string) => {
    if (!summary) return title || fallback;
    if (!title) return summary;
    if (summary === title || summary.startsWith(`${title} ·`) || summary.startsWith(`${title} `)) {
      return summary;
    }
    return title.startsWith('已') ? `${title} · ${summary}` : summary;
  };
  if (tool.kind === 'createRoomProject' && tool.status === 'executed') {
    return titleWithSummary(localizeToolLabel(t, 'chat.toolEvent.fallback.roomProjectCreated', '已创建工作区'));
  }
  if (tool.kind === 'createProjectFile' && tool.status === 'executed') {
    return titleWithSummary(localizeToolLabel(t, 'chat.toolEvent.fallback.projectFileCreated', '已创建工作区文件'));
  }
  if (tool.kind === 'patchRoomProject' && tool.status === 'executed') {
    return titleWithSummary(localizeToolLabel(t, 'chat.toolEvent.fallback.projectCoverUpdated', '已更新工作区封面'));
  }
  if ((
    tool.kind === 'appendProjectFile'
    || tool.kind === 'insertProjectFile'
    || tool.kind === 'replaceProjectFileLines'
    || tool.kind === 'writeProjectFiles'
    || tool.kind === 'editProjectFileText'
    || tool.kind === 'deleteProjectFile'
  ) && tool.status === 'executed') {
    return titleWithSummary(localizeToolLabel(t, 'chat.toolEvent.fallback.projectFileUpdated', '已更新工作区文件'));
  }
  if ((tool.kind === 'listProjectFiles' || tool.kind === 'searchProjectFiles' || tool.kind === 'checkProjectPreview' || tool.kind === 'inspectProjectRuntime') && tool.status === 'executed') {
    return titleWithSummary(localizeToolLabel(t, 'chat.toolEvent.fallback.workspaceChecked', '已检查工作区'));
  }
  if ((tool.kind === 'readProjectFile' || tool.kind === 'readProjectFileContext') && tool.status === 'executed') {
    return titleWithSummary(localizeToolLabel(t, 'chat.toolEvent.fallback.projectFileRead', '已读取工作区文件'));
  }
  if (tool.kind === 'promoteCardToProject' && tool.status === 'executed') {
    return titleWithSummary(localizeToolLabel(t, 'chat.toolEvent.fallback.promotedToWorkspace', '已升为工作区'));
  }
  if (tool.kind === 'createCodeCard' && tool.status === 'executed') {
    return titleWithSummary(localizeToolLabel(t, 'chat.toolEvent.fallback.codeCardCreated', '已创建卡片'));
  }
  if ((
    tool.kind === 'patchCodeCard'
    || tool.kind === 'appendCodeCard'
    || tool.kind === 'editCodeCardText'
  ) && tool.status === 'executed') {
    return titleWithSummary(localizeToolLabel(t, 'chat.toolEvent.fallback.codeCardUpdated', '已更新卡片'));
  }
  if (tool.kind === 'saveAttachmentAsCodeCard' && tool.status === 'executed') {
    return titleWithSummary(localizeToolLabel(t, 'chat.toolEvent.fallback.savedToCard', '已存入卡片'));
  }
  if (tool.kind === 'saveArchiveEntryAsCodeCard' && tool.status === 'executed') {
    return titleWithSummary(localizeToolLabel(t, 'chat.toolEvent.fallback.savedToCard', '已存入卡片'));
  }
  if (tool.kind === 'invokeCodeCardTool' && tool.status === 'executed') {
    return tool.targetLabel?.trim() || tool.toolName?.trim() || localizeToolLabel(t, 'chat.toolEvent.fallback.toolCardCalled', '已调用工具卡');
  }
  if (tool.kind === 'startTask' && tool.status === 'executed') {
    return tool.targetLabel?.trim() || localizeToolLabel(t, 'chat.toolEvent.fallback.taskStarted', '已开启任务');
  }
  if (tool.kind === 'completeTask' && tool.status === 'executed') {
    return tool.targetLabel?.trim() || localizeToolLabel(t, 'chat.toolEvent.fallback.taskCompleted', '已完成任务');
  }
  return tool.summary;
}
