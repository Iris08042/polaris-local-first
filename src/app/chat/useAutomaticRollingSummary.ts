import { useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { updateRollingSummaryForConversation } from './rollingSummary';

const AUTOMATIC_ROLLING_SUMMARY_DELAY_MS = 1_500;

export function useAutomaticRollingSummary({ enabled }: { enabled: boolean }) {
  const conversations = useChatStore((state) => state.conversations);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      conversations.forEach((conversation) => {
        if (!conversation.collaboratorId || conversation.kind === 'group') return;
        void updateRollingSummaryForConversation(conversation.id).catch((error) => {
          console.warn('[rolling-summary] automatic update failed', error);
        });
      });
    }, AUTOMATIC_ROLLING_SUMMARY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [conversations, enabled]);
}
