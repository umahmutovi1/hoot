/**
 * Voice (Sprint 18, decision 18 Nov 2026): Whisper turns speech into text on the device in every
 * language; Kokoro reads aloud only in English for now (no Bosnian voice under a licence that
 * fits), so in Bosnian the app says the voice is not available yet.
 */

export type VoiceLocale = 'bs' | 'en'

/**
 * Kokoro speaks English only; Bosnian text is never read with an English voice. Bosnian is read
 * only with a voice the phone already has (`hasSystemVoice`, see `pickSystemVoice()`).
 */
export function canSpeak(locale: VoiceLocale, hasSystemVoice = false): boolean {
  return locale === 'en' || hasSystemVoice
}

/** Languages close enough to read Bosnian text, best first. */
const BOSNIAN_LIKE = ['bs', 'hr', 'sr-latn', 'sr']

/**
 * The phone's own voice for Bosnian text (`speechSynthesis`): Bosnian, then Croatian, then
 * Serbian; a local voice before a network one. Null when the phone has none.
 */
export function pickSystemVoice<V extends { lang: string; localService: boolean }>(
  voices: V[],
  locale: VoiceLocale,
): V | null {
  if (locale !== 'bs') return null
  const rank = (v: V) => {
    const lang = v.lang.toLowerCase().replace('_', '-')
    const i = BOSNIAN_LIKE.findIndex((l) => lang === l || lang.startsWith(`${l}-`))
    return i < 0 ? -1 : i * 2 + (v.localService ? 0 : 1)
  }
  const ranked = voices.filter((v) => rank(v) >= 0).sort((a, b) => rank(a) - rank(b))
  return ranked[0] ?? null
}

/** Whisper's language for the app locale (Bosnian is close enough to its "bosnian"). */
export function whisperLanguage(locale: VoiceLocale): 'bosnian' | 'english' {
  return locale === 'bs' ? 'bosnian' : 'english'
}

/**
 * What a voice reads from a tutor answer or question: markdown marks and math dropped, so it
 * does not say "dollar" or "asterisk". Math is left out (Kokoro cannot read LaTeX).
 */
export function speakable(markdown: string): string {
  return markdown
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/`{1,3}[^`]*`{1,3}/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Whisper writes "[BLANK_AUDIO]" or "(music)" for silence; that is no answer. */
export function cleanTranscript(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
