/**
 * Voice (Sprint 18, decision 18 Nov 2026): Whisper turns speech into text on the device in every
 * language; Kokoro reads aloud only in English for now (no Bosnian voice under a licence that
 * fits), so in Bosnian the app says the voice is not available yet.
 */

export type VoiceLocale = 'bs' | 'en'

/** Kokoro speaks English only; Bosnian text is never read with an English voice. */
export function canSpeak(locale: VoiceLocale): boolean {
  return locale === 'en'
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
