/**
 * MSW Node server instance shared across all unit/integration tests.
 * Add handlers per-test with server.use(...) inside each suite.
 * Handlers are reset after every test via setup.ts.
 */
import { setupServer } from 'msw/node'

export const server = setupServer()
