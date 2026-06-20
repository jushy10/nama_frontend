import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// We don't enable Vitest globals, so register Testing Library's DOM cleanup
// manually to unmount components between tests.
afterEach(() => {
  cleanup()
})
