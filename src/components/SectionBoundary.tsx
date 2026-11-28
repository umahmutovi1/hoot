import { Component, type ReactNode } from 'react'

/**
 * Keeps one card's render error inside that card: the rest of the screen stays usable instead of
 * the whole route falling to "Učitaj ponovo". The card is left out; the error goes to the console.
 */
export class SectionBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.name}]`, error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
