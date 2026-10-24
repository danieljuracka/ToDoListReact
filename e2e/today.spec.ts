import { expect, test, type Page } from '@playwright/test'

const combobox = (page: Page) => page.getByRole('combobox')
const addButton = (page: Page) => page.getByRole('button', { name: 'Pridať misiu na tento deň' })
const mission = (page: Page, title: string) => page.getByRole('listitem').filter({ hasText: title })

async function addNew(page: Page, title: string) {
  await combobox(page).fill(title)
  await addButton(page).click()
  await expect(mission(page, title)).toBeVisible()
}

test('rýchlo pridaná misia sa dá splniť a zobrazí sa v kalendári', async ({ page }) => {
  await page.goto('/')
  await addNew(page, 'Kúpiť chlieb')

  const row = mission(page, 'Kúpiť chlieb')
  await row.getByRole('button', { name: 'Označiť ako hotové' }).click()
  await expect(row.getByRole('button', { name: 'Označiť ako nehotové' })).toBeVisible()
  await expect(page.getByText('Splnené misie 1/1')).toBeVisible()

  await page.getByRole('link', { name: 'Kalendár' }).click()
  await expect(page.getByText('100 %').first()).toBeVisible()

  await page.getByRole('link', { name: 'Dnes' }).click()
  await expect(mission(page, 'Kúpiť chlieb')).toBeVisible()

  await page.getByRole('link', { name: 'Aktivity' }).click()
  await expect(page.getByRole('link').filter({ hasText: 'Kúpiť chlieb' })).toContainText('Podľa potreby')
})

test('existujúcu aktivitu vyberiem zo zoznamu a pridám na iný deň', async ({ page }) => {
  await page.goto('/')
  await addNew(page, 'Kúpiť chlieb')
  await addNew(page, 'Zavolať mame')

  // aktivita, ktorá už v dni je, sa nedá vybrať
  await combobox(page).click()
  await expect(page.getByRole('option', { name: /Kúpiť chlieb/ })).toHaveAttribute('aria-disabled', 'true')

  await page.getByRole('button', { name: 'Nasledujúci deň' }).click()
  // filter funguje aj bez diakritiky
  await combobox(page).fill('kup')
  await expect(page.getByRole('option', { name: /Zavolať mame/ })).toBeHidden()
  await page.getByRole('option', { name: /Kúpiť chlieb/ }).click()
  await expect(combobox(page)).toHaveValue('Kúpiť chlieb')
  await addButton(page).click()

  await expect(mission(page, 'Kúpiť chlieb')).toBeVisible()
  await expect(mission(page, 'Zavolať mame')).toBeHidden()

  await page.getByRole('link', { name: 'Aktivity' }).click()
  await expect(page.getByRole('link').filter({ hasText: 'Kúpiť chlieb' })).toHaveCount(1)
})

test('misiu pridanú omylom odoberiem z dňa a dá sa znova vybrať', async ({ page }) => {
  await page.goto('/')
  await addNew(page, 'Omyl')
  await mission(page, 'Omyl').getByRole('button', { name: 'Ďalšie akcie' }).click()
  await page.getByRole('button', { name: 'Odobrať z dňa' }).click()
  await expect(mission(page, 'Omyl')).toBeHidden()

  await combobox(page).click()
  await expect(page.getByRole('option', { name: /Omyl/ })).not.toHaveAttribute('aria-disabled', 'true')
})
