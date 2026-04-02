/**
 * E2E tests for the PR-01 Auth Shell
 * Framework: Playwright
 *
 * Prerequisites:
 *   - Dev server running on http://localhost:3000 (or BASE_URL env var)
 *   - Test Supabase project seeded with:
 *       confirmed user:   e2e-user@oclabs.test / Password1234!
 *       unconfirmed user: not-confirmed@oclabs.test (confirmation email not clicked)
 *
 * Run with:
 *   npx playwright test src/test/e2e/auth.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

// ---- helpers ---------------------------------------------------------------

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function fillSignupForm(
  page: Page,
  name: string,
  email: string,
  password: string
) {
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
}

// ---- login page ------------------------------------------------------------

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
  })

  test('renders the login form', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('shows an error for wrong credentials', async ({ page }) => {
    await fillLoginForm(page, 'nobody@example.com', 'wrongpassword')
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible()
  })

  test('redirects to /discover after a successful login', async ({ page }) => {
    await fillLoginForm(page, 'e2e-user@oclabs.test', 'Password1234!')
    await expect(page).toHaveURL(`${BASE_URL}/discover`)
  })

  test('honours a safe redirectTo param after login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?redirectTo=%2Fprojects`)
    await fillLoginForm(page, 'e2e-user@oclabs.test', 'Password1234!')
    await expect(page).toHaveURL(`${BASE_URL}/projects`)
  })

  test('ignores an unsafe redirectTo param and goes to /discover', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?redirectTo=https%3A%2F%2Fevil.example.com`)
    await fillLoginForm(page, 'e2e-user@oclabs.test', 'Password1234!')
    await expect(page).toHaveURL(`${BASE_URL}/discover`)
  })

  test('renders the GitHub OAuth button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /continue with github/i })
    ).toBeVisible()
  })
})

// ---- signup page -----------------------------------------------------------

test.describe('Signup page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`)
  })

  test('renders the signup form', async ({ page }) => {
    await expect(page.getByLabel('Name')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('shows a name-required error when name is blank', async ({ page }) => {
    await fillSignupForm(page, '', 'test@example.com', 'secure123')
    await expect(page.getByText('Name is required.')).toBeVisible()
  })

  test('shows an invalid-email error for a malformed email', async ({ page }) => {
    await fillSignupForm(page, 'Alice', 'not-an-email', 'secure123')
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible()
  })

  test('shows a password-length error for a short password', async ({ page }) => {
    await fillSignupForm(page, 'Alice', 'alice@example.com', '12345')
    await expect(page.getByText('Password must be at least 6 characters.')).toBeVisible()
  })

  test('does not reveal whether an email address is already registered', async ({ page }) => {
    // Sign up with the known existing address
    await fillSignupForm(page, 'Alice', 'e2e-user@oclabs.test', 'Password1234!')
    // The response must match the same message shown for a new email
    await expect(
      page.getByText(/check your email — if this address is new/i)
    ).toBeVisible()
    // Must not show words that indicate the address exists
    await expect(page.getByText(/already registered/i)).not.toBeVisible()
    await expect(page.getByText(/already exists/i)).not.toBeVisible()
  })

  test('shows confirmation message after successful signup with confirmation email', async ({ page }) => {
    // Use a unique email so this test is not flaky
    const unique = `e2e-${Date.now()}@oclabs.test`
    await fillSignupForm(page, 'New User', unique, 'Password1234!')
    await expect(
      page.getByText(/check your email for a confirmation link/i)
    ).toBeVisible()
  })

  test('confirmation view shows a link back to /login', async ({ page }) => {
    const unique = `e2e-${Date.now()}@oclabs.test`
    await fillSignupForm(page, 'New User', unique, 'Password1234!')
    await expect(page.getByRole('link', { name: /back to sign in/i })).toHaveAttribute(
      'href',
      '/login'
    )
  })
})

// ---- middleware / protected routes -----------------------------------------

test.describe('Middleware protection', () => {
  test('redirects an unauthenticated user from /discover to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/discover`)
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/login`))
  })

  test('includes the original path as redirectTo in the login URL', async ({ page }) => {
    await page.goto(`${BASE_URL}/discover`)
    const url = new URL(page.url())
    expect(url.searchParams.get('redirectTo')).toBe('/discover')
  })

  test('/signup is accessible without authentication', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`)
    // Should not redirect to login
    await expect(page).toHaveURL(`${BASE_URL}/signup`)
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
  })

  test('/login is accessible without authentication', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await expect(page).toHaveURL(`${BASE_URL}/login`)
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })
})

// ---- auth callback ---------------------------------------------------------

test.describe('Auth callback route', () => {
  test('redirects to /login when the code param is missing', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/callback`)
    await expect(page).toHaveURL(`${BASE_URL}/login`)
  })

  test('redirects to /login when the code param is invalid', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/callback?code=not-a-real-code`)
    await expect(page).toHaveURL(`${BASE_URL}/login`)
  })
})
