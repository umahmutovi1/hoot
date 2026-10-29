import { describe, expect, it } from 'vitest'
import { feedKindFromUrl } from './feedKind'

describe('feedKindFromUrl', () => {
  it('reads a Moodle export as deadlines', () => {
    expect(
      feedKindFromUrl(
        'https://moodle.example.ba/calendar/export_execute.php?userid=12&authtoken=abc&preset_what=all&preset_time=recentupcoming',
      ),
    ).toBe('deadlines')
    expect(
      feedKindFromUrl(
        'webcal://lms.uni.ba/moodle/calendar/export_execute.php?userid=1&authtoken=x',
      ),
    ).toBe('deadlines')
  })

  it('reads Google, Outlook and unknown links as busy', () => {
    expect(
      feedKindFromUrl(
        'https://calendar.google.com/calendar/ical/me%40gmail.com/private-abc/basic.ics',
      ),
    ).toBe('busy')
    expect(feedKindFromUrl('https://outlook.office365.com/owa/calendar/abc/def/calendar.ics')).toBe(
      'busy',
    )
    expect(feedKindFromUrl('not a link')).toBe('busy')
  })
})
