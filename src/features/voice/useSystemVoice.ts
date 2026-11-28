import { useEffect, useState } from 'react'
import type { VoiceLocale } from './text'
import { pickSystemVoice } from './text'

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : undefined)

/**
 * The phone's built-in voice for the app language (Bosnian, Croatian or Serbian for `bs`), or
 * null. Voices arrive late on some browsers, so it listens for `voiceschanged`.
 */
export function useSystemVoice(locale: VoiceLocale): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(() =>
    pickSystemVoice(synth()?.getVoices() ?? [], locale),
  )
  useEffect(() => {
    const s = synth()
    if (!s) return
    const update = () => setVoice(pickSystemVoice(s.getVoices(), locale))
    update()
    s.addEventListener('voiceschanged', update)
    return () => s.removeEventListener('voiceschanged', update)
  }, [locale])
  return voice
}
