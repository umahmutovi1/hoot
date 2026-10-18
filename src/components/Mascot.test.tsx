import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Mascot } from './Mascot'

describe('Mascot', () => {
  it('renders the pose with a 2x source and the given size', () => {
    render(<Mascot pose="reading" size={120} alt="Owl reading" />)
    const img = screen.getByRole('img', { name: 'Owl reading' })
    expect(img).toHaveAttribute('src', '/mascot/reading.webp')
    expect(img).toHaveAttribute('srcset', '/mascot/reading@2x.webp 2x')
    expect(img).toHaveAttribute('width', '120')
    expect(img).toHaveAttribute('height', '120')
  })

  it('is hidden from assistive tech when decorative', () => {
    const { container } = render(<Mascot pose="timer-head" size={48} />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('aria-hidden', 'true')
  })
})
