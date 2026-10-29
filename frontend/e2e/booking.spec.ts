import { expect, test, type Page } from '@playwright/test'

const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

async function register(page: Page, name: string) {
  await page.goto('/register')
  await page.getByPlaceholder('Full name').fill(name)
  await page.getByPlaceholder('Email address').fill(`e2e+${Date.now()}@example.com`)
  await page.getByPlaceholder('Mobile number').fill('9876543210')
  await page.getByPlaceholder('Password', { exact: true }).fill('Travel2026!')
  await page.getByPlaceholder('Confirm password').fill('Travel2026!')
  await page.getByRole('button', { name: /create account/i }).click()
  // The account menu (it has aria-expanded) shows the first name once signed in.
  await expect(page.locator('header button[aria-expanded]').filter({ hasText: name.split(' ')[0] })).toBeVisible()
}

const freeSeat = (page: Page) => page.getByRole('button', { name: /^\d+[A-F], /, pressed: false, disabled: false }).first()

/** Picks the first Economy fare and waits until the seat map has loaded which seats are taken. */
async function openEconomySeatMap(page: Page) {
  const seatsLoaded = page.waitForResponse((r) => r.url().includes('/api/trips/') && r.url().includes('/seats?') && r.ok())
  await page.locator('article').first().getByRole('button', { name: /economy/i }).click()
  await expect(page).toHaveURL(/\/book\/seats/)
  await seatsLoaded
}

test('books a flight from search to e-ticket', async ({ page }) => {
  await register(page, 'Priya Sharma')

  await page.goto(`/search?mode=flight&from=BLR&to=GOI&date=${inDays(21)}&ad=1`)
  await openEconomySeatMap(page)

  await freeSeat(page).click()
  await expect(page.getByText('1 of 1 selected')).toBeVisible()
  await page.getByRole('button', { name: /^continue/i }).click()
  await expect(page).toHaveURL(/\/book\/details/)

  // Name, email and phone are pre-filled from the account.
  await expect(page.locator('[data-field="p0.name"]')).toHaveValue('Priya Sharma')
  await page.locator('[data-field="p0.age"]').fill('27')
  await page.locator('[data-field="p0.gender"]').selectOption('Female')
  await page.getByRole('button', { name: /continue to payment/i }).click()
  await expect(page).toHaveURL(/\/book\/payment/)

  await page.getByRole('button', { name: 'FLYHIGH' }).click()
  await expect(page.getByText('FLYHIGH applied')).toBeVisible()
  await page.locator('input[autocomplete="cc-number"]').fill('4111111111111111')
  await page.locator('input[autocomplete="cc-name"]').fill('Priya Sharma')
  await page.locator('input[autocomplete="cc-exp"]').fill('1229')
  await page.locator('input[autocomplete="cc-csc"]').fill('123')
  await page.getByRole('button', { name: /^pay ₹/i }).click()

  await expect(page).toHaveURL(/\/ticket\/[A-Z0-9]{6}$/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /you're all set, priya/i })).toBeVisible()
  await expect(page.getByText('Confirmed').first()).toBeVisible()

  // The booking is stored on the server: it survives a reload and shows in My trips.
  const pnr = page.url().split('/').pop()!
  await page.goto('/trips')
  await page.reload()
  await expect(page.getByText(`PNR ${pnr}`)).toBeVisible()
})

test('a seat held by one traveller is unavailable to another', async ({ browser }) => {
  const date = inDays(28)
  const url = `/search?mode=flight&from=DEL&to=BOM&date=${date}&ad=1`
  const asha = await (await browser.newContext()).newPage()
  const ravi = await (await browser.newContext()).newPage()
  await register(asha, 'Asha Rao')
  await register(ravi, 'Ravi Kumar')

  await asha.goto(url)
  await openEconomySeatMap(asha)
  const seat = freeSeat(asha)
  const seatId = (await seat.getAttribute('aria-label'))!.split(',')[0]
  await seat.click()
  await expect(asha.getByText('1 of 1 selected')).toBeVisible()
  await asha.getByRole('button', { name: /^continue/i }).click()
  await expect(asha).toHaveURL(/\/book\/details/) // seat is now held for Asha

  await ravi.goto(url)
  await openEconomySeatMap(ravi)
  await expect(ravi.getByRole('button', { name: new RegExp(`^${seatId}, .*booked$`) })).toBeDisabled()
})

test('pages that need an account redirect to login', async ({ page }) => {
  await page.goto('/trips')
  await expect(page).toHaveURL(/\/login\?next=%2Ftrips/)
})
