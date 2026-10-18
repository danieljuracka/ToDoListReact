import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type ChangeEvent } from 'react'
import { buttonPrimary, buttonSecondary, checkbox } from '@/components/ui'
import { exportBackup, parseBackup, restoreBackup } from '@/db/backup'
import { db } from '@/db/db'
import { materializeUpTo } from '@/db/days'
import { getSettings, updateSettings } from '@/db/settings'
import { todayISO } from '@/domain/dates'

export function SettingsPage() {
  const settings = useLiveQuery(getSettings, [])
  const counts = useLiveQuery(async () => ({ activities: await db.activities.count(), occurrences: await db.occurrences.count() }), [])
  const persisted = useLiveQuery(async () => (await navigator.storage?.persisted?.()) ?? false, [])
  const [message, setMessage] = useState<string>()
  const fileInput = useRef<HTMLInputElement>(null)

  const exportData = async () => {
    const backup = await exportBackup()
    const name = `denny-todo-${todayISO()}.json`
    const file = new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' })
    // Na iPhone ponúkne systémové menu (Uložiť do Súborov, AirDrop…), inde stiahne súbor.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const backup = parseBackup(await file.text())
      const summary = `${backup.activities.length} aktivít a ${backup.occurrences.length} záznamov histórie`
      if (!confirm(`Nahradiť všetky dáta v zariadení zálohou (${summary})?`)) return
      await restoreBackup(backup)
      await materializeUpTo(todayISO())
      setMessage(`Obnovené: ${summary}.`)
    } catch (err) {
      setMessage(err instanceof SyntaxError ? 'Súbor nie je platný JSON.' : (err as Error).message)
    }
  }

  return (
    <section className="space-y-6 pt-4">
      <h1 className="heading text-2xl">Nastavenia</h1>

      <label className="flex items-center justify-between panel p-3">
        <span>
          Nové aktivity prenášať na ďalší deň
          <span className="block text-sm text-muted">Dá sa zmeniť pri každej aktivite.</span>
        </span>
        <input
          type="checkbox"
          className={checkbox}
          checked={settings?.defaultCarryOver ?? true}
          onChange={(e) => void updateSettings({ defaultCarryOver: e.target.checked })}
        />
      </label>

      <div className="space-y-3 panel p-3">
        <div>
          <h2 className="font-display tracking-wide text-accent2">Záloha dát</h2>
          <p className="text-sm text-muted">
            Dáta sú iba v tomto zariadení. Pri výmene telefónu alebo vymazaní dát prehliadača sa stratia, preto si
            pravidelne ulož zálohu.
          </p>
        </div>
        <div className="flex gap-2">
          <button className={`${buttonPrimary} flex-1`} onClick={() => void exportData()}>
            Exportovať
          </button>
          <button className={`${buttonSecondary} flex-1`} onClick={() => fileInput.current?.click()}>
            Importovať
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => void importData(e)} />
        </div>
        {message && <p className="text-sm">{message}</p>}
      </div>

      <dl className="space-y-1 text-sm text-muted">
        <div>
          Aktivity: {counts?.activities ?? '–'} · Záznamy histórie: {counts?.occurrences ?? '–'}
        </div>
        <div>Trvalé úložisko: {persisted ? 'áno' : 'nie (prehliadač môže dáta zmazať)'}</div>
      </dl>
    </section>
  )
}
