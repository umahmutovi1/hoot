/** Number of onboarding steps (PRD "Onboarding"). */
export const ONBOARDING_STEPS = 8

/** The browser's time zone (PRD: onboarding takes it from the browser). */
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
