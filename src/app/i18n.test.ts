import { afterEach, describe, expect, it } from 'vitest'
import i18n, { setAddressGender } from './i18n'

describe('address form', () => {
  afterEach(() => setAddressGender(null))

  it('keeps the written (feminine) form until the user picks one', async () => {
    await i18n.changeLanguage('bs')
    expect(i18n.t('today.noTimer.howLong')).toBe('Koliko si učila?')
    setAddressGender('female')
    expect(i18n.t('today.noTimer.howLong')).toBe('Koliko si učila?')
  })

  it('uses the masculine variant where a string has one, also through getFixedT', async () => {
    await i18n.changeLanguage('bs')
    setAddressGender('male')
    expect(i18n.t('today.noTimer.howLong')).toBe('Koliko si učio?')
    expect(i18n.getFixedT('bs')('session.end.howFar')).toBe('Dokle si stigao?')
    // No gendered word: the base string, with interpolation and plurals untouched.
    expect(i18n.t('app.back')).toBe('Nazad')
    expect(i18n.t('points.sub', { count: 3 })).toBe('3 predmeta')
    expect(i18n.t('checkin.summary', { hours: '5 h' })).toContain('si učio 5 h')
  })

  it('changes nothing in English', async () => {
    await i18n.changeLanguage('en')
    setAddressGender('male')
    expect(i18n.t('app.back')).toBe('Back')
    await i18n.changeLanguage('bs')
  })
})
