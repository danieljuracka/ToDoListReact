import { expect, test } from '@playwright/test'

test('spodná navigácia prepína obrazovky', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Kalendár' }).click()
  await expect(page.getByRole('heading', { name: 'Kalendár' })).toBeVisible()
  await page.getByRole('link', { name: 'Aktivity' }).click()
  await expect(page.getByRole('heading', { name: 'Aktivity' })).toBeVisible()
})
