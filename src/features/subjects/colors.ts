import { isSubjectColor, type SubjectColor } from './model'

// Literal class names so Tailwind can see them; tokens live in src/index.css.
export interface SubjectPalette {
  hex: string // picker swatch only; matches --color-subject-<key>
  bar: string
  border: string
  stroke: string
  soft: string
  track: string
  deepText: string
  inkText: string
}

export const SUBJECT_PALETTES: Record<SubjectColor, SubjectPalette> = {
  pink: {
    hex: '#D97AA0',
    bar: 'bg-subject-pink',
    border: 'border-subject-pink',
    stroke: 'stroke-subject-pink',
    soft: 'bg-subject-pink-soft',
    track: 'bg-subject-pink-track',
    deepText: 'text-subject-pink-deep',
    inkText: 'text-subject-pink-ink',
  },
  lavender: {
    hex: '#8C84E0',
    bar: 'bg-subject-lavender',
    border: 'border-subject-lavender',
    stroke: 'stroke-subject-lavender',
    soft: 'bg-subject-lavender-soft',
    track: 'bg-subject-lavender-track',
    deepText: 'text-subject-lavender-deep',
    inkText: 'text-subject-lavender-ink',
  },
  blue: {
    hex: '#6FA3D6',
    bar: 'bg-subject-blue',
    border: 'border-subject-blue',
    stroke: 'stroke-subject-blue',
    soft: 'bg-subject-blue-soft',
    track: 'bg-subject-blue-track',
    deepText: 'text-subject-blue-deep',
    inkText: 'text-subject-blue-ink',
  },
  green: {
    hex: '#6FAE8A',
    bar: 'bg-subject-green',
    border: 'border-subject-green',
    stroke: 'stroke-subject-green',
    soft: 'bg-subject-green-soft',
    track: 'bg-subject-green-track',
    deepText: 'text-subject-green-deep',
    inkText: 'text-subject-green-ink',
  },
  orange: {
    hex: '#D9774B',
    bar: 'bg-subject-orange',
    border: 'border-subject-orange',
    stroke: 'stroke-subject-orange',
    soft: 'bg-subject-orange-soft',
    track: 'bg-subject-orange-track',
    deepText: 'text-subject-orange-deep',
    inkText: 'text-subject-orange-ink',
  },
  slate: {
    hex: '#7B8494',
    bar: 'bg-subject-slate',
    border: 'border-subject-slate',
    stroke: 'stroke-subject-slate',
    soft: 'bg-subject-slate-soft',
    track: 'bg-subject-slate-track',
    deepText: 'text-subject-slate-deep',
    inkText: 'text-subject-slate-ink',
  },
}

export function paletteOf(color: string | null): SubjectPalette {
  return SUBJECT_PALETTES[isSubjectColor(color) ? color : 'lavender']
}
