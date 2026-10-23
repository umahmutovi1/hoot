import type { StrengthBand } from '@/lib/srs'

/** Colors of the strength bands (Predmet, Jedinica, Provjera znanja). */
export const BAND_BG: Record<StrengthBand, string> = {
  strong: 'bg-strength-strong',
  good: 'bg-strength-good',
  weak: 'bg-strength-weak',
  fading: 'bg-strength-fading',
}

export const BANDS: StrengthBand[] = ['strong', 'good', 'weak', 'fading']
