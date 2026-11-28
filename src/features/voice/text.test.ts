import { describe, expect, it } from 'vitest'
import { canSpeak, cleanTranscript, pickSystemVoice, speakable, whisperLanguage } from './text'

describe('voice text', () => {
  it('speaks English only and transcribes both languages', () => {
    expect(canSpeak('en')).toBe(true)
    expect(canSpeak('bs')).toBe(false)
    expect(whisperLanguage('bs')).toBe('bosnian')
    expect(whisperLanguage('en')).toBe('english')
  })

  it("reads Bosnian only with the phone's own Bosnian-like voice", () => {
    expect(canSpeak('bs', true)).toBe(true)
    const v = (lang: string, localService = true) => ({ lang, localService })
    expect(pickSystemVoice([v('en-US'), v('de-DE')], 'bs')).toBeNull()
    expect(pickSystemVoice([v('sr-RS'), v('hr-HR', false), v('hr_HR')], 'bs')).toEqual(v('hr_HR'))
    expect(pickSystemVoice([v('hr-HR'), v('bs-BA', false)], 'bs')).toEqual(v('bs-BA', false))
    expect(pickSystemVoice([v('hr-HR')], 'en')).toBeNull()
  })

  it('reads text without markdown marks or math', () => {
    expect(
      speakable(
        '**Parseval:** power is the sum $|a_k|^2$ over\n- all [harmonics](http://x)\n$$x=1$$',
      ),
    ).toBe('Parseval: power is the sum over all harmonics')
  })

  it('drops Whisper silence markers', () => {
    expect(cleanTranscript(' [BLANK_AUDIO] ')).toBe('')
    expect(cleanTranscript('Amplitude ostaju iste (music)')).toBe('Amplitude ostaju iste')
  })
})
