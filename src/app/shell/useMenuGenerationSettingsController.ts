import type {
  ImageGenerationSettings,
  VoiceGenerationSettings
} from '../../types/domain';

type UseMenuGenerationSettingsControllerArgs = {
  imageGeneration: ImageGenerationSettings;
  voiceGeneration: VoiceGenerationSettings;
  setImageGeneration: (patch: Partial<ImageGenerationSettings>) => void;
  setVoiceGeneration: (patch: Partial<VoiceGenerationSettings>) => void;
};

export function useMenuGenerationSettingsController({
  imageGeneration,
  voiceGeneration,
  setImageGeneration,
  setVoiceGeneration
}: UseMenuGenerationSettingsControllerArgs) {
  return {
    imageGeneration,
    voiceGeneration,
    onSetImageGeneration: setImageGeneration,
    onSetVoiceGeneration: setVoiceGeneration
  };
}
