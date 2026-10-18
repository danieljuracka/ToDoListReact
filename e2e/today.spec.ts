import { expect, test } from '@playwright/test'

test('rýchlo pridaná misia sa dá splniť a zobrazí sa v kalendári', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Nová misia na tento deň').fill('Kúpiť chlieb')
  await page.getByRole('button', { name: '+', exact: true }).click()

  const row = page.getByRole('listitem').filter({ hasText: 'Kúpiť chlieb' })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Označiť ako hotové' }).click()
  await expect(row.getByRole('button', { name: 'Označiť ako nehotové' })).toBeVisible()
  await expect(page.getByText('Splnené misie 1/1')).toBeVisible()

  await page.getByRole('link', { name: 'Kalendár' }).click()
  await expect(page.getByText('100 %').first()).toBeVisible()

  await page.getByRole('link', { name: 'Dnes' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Kúpiť chlieb' })).toBeVisible()
})
