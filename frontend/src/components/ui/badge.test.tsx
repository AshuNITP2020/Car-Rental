import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './badge'

describe('StatusBadge', () => {
  it('renders the humanized status text', () => {
    render(<StatusBadge status="OUT_OF_SERVICE" />)
    expect(screen.getByText('Out Of Service')).toBeInTheDocument()
  })

  it('falls back to a neutral tone for unknown statuses', () => {
    render(<StatusBadge status="SOMETHING_NEW" />)
    expect(screen.getByText('Something New')).toBeInTheDocument()
  })
})
