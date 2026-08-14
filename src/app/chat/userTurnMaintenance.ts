import { runDailyCloudBackupAfterUserMessage } from '../backup/dailyCloudBackup';
import type { ChatReplyRunResult } from './chatReplyRuntime';
import { updateRollingSummaryForConversation } from './rollingSummary';

export async function runUserTurnMaintenance(
  conversationId: string,
  replyResult: ChatReplyRunResult
) {
  if (replyResult.status === 'completed') {
    try {
      await updateRollingSummaryForConversation(conversationId);
    } catch (error) {
      console.warn('[rolling-summary] user-turn update failed', error);
    }
  }

  try {
    await runDailyCloudBackupAfterUserMessage();
  } catch (error) {
    console.warn('[cloud-backup] daily user-turn upload failed', error);
  }
}
