import { expect, test } from '@playwright/test'

test('aktivita podľa potreby nemá dátum ani čas', async ({ page }) => {
  await page.goto('/#/aktivity/nova')
  await expect(page.getByText('Čas (voliteľné)')).toBeVisible()
  await page.getByRole('combobox', { name: 'Opakovanie' }).selectOption({ label: 'Podľa potreby' })
  for (const field of ['Čas (voliteľné)', 'Dátum', 'Od', 'Do (voliteľné)']) {
    await expect(page.getByText(field, { exact: true })).toBeHidden()
  }
  await expect(page.getByText('Zobrazí sa iba v dni, do ktorých ju pridáš na obrazovke dňa.')).toBeVisible()
})

test('vypnutá priorita zmizne z formulára aj zo zoznamu misií', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('combobox').fill('Beh')
  await page.getByRole('button', { name: 'Pridať misiu na tento deň' }).click()
  await expect(page.getByTitle('Rank B')).toBeVisible()

  await page.getByRole('link', { name: 'Nastavenia' }).click()
  const usePriority = page.getByRole('checkbox', { name: /Používať prioritu/ })
  await usePriority.click()
  await expect(usePriority).not.toBeChecked()

  await page.getByRole('link', { name: 'Dnes' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Beh' })).toBeVisible()
  await expect(page.getByTitle('Rank B')).toBeHidden()

  await page.goto('/#/aktivity/nova')
  await expect(page.getByText('Priorita', { exact: true })).toBeHidden()
})
