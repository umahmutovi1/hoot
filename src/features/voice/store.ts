import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * Voice settings (Postavke → Glas). Per device: the voice models are downloaded and cached on
 * each device anyway.
 */
interface VoiceSettings {
  /** The tutor and the assistant read their answers and questions aloud (English only). */
  speakAloud: boolean
  /** Usmeni starts the microphone instead of a text box. */
  answerByVoice: boolean
  set: (patch: Partial<Pick<VoiceSettings, 'speakAloud' | 'answerByVoice'>>) => void
}

export const useVoiceSettings = create<VoiceSettings>()(
  persist(
    (set) => ({
      speakAloud: true,
      answerByVoice: true,
      set: (patch) => set(patch),
    }),
    {
      name: 'hoot-voice',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ speakAloud: s.speakAloud, answerByVoice: s.answerByVoice }),
    },
  ),
)
