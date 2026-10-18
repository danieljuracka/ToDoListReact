import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { buttonPrimary } from '@/components/ui'
import { db } from '@/db/db'
import { describeRule } from '@/domain/describe'

export function ActivitiesPage() {
  const [showArchived, setShowArchived] = useState(false)
  const activities = useLiveQuery(() => db.activities.toArray(), [])
  const visible = (activities ?? [])
    .filter((a) => a.archived === showArchived)
    .sort((a, b) => a.title.localeCompare(b.title, 'sk'))

  return (
    <section className="pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Aktivity</h1>
        <Link to="/aktivity/nova" className={buttonPrimary}>
          + Nová
        </Link>
      </div>

      <div className="mt-4 flex rounded-xl bg-slate-100 p-1 text-sm dark:bg-slate-900">
        {[false, true].map((archived) => (
          <button
            key={String(archived)}
            onClick={() => setShowArchived(archived)}
            className={`flex-1 rounded-lg py-1.5 font-medium ${
              showArchived === archived ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'
            }`}
          >
            {archived ? 'Archivované' : 'Aktívne'}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {visible.map((a) => (
          <li key={a.id}>
            <Link to={`/aktivity/${a.id}`} className="block rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
              <div className="font-medium">
                {a.priority === 'high' && <span className="mr-1 text-red-500">!</span>}
                {a.title}
              </div>
              <div className="text-sm text-slate-500">
                {[describeRule(a.recurrence), a.timeOfDay, a.carryOver && 'prenáša sa'].filter(Boolean).join(' · ')}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {activities && visible.length === 0 && (
        <p className="mt-6 text-slate-500">
          {showArchived ? 'Žiadne archivované aktivity.' : 'Zatiaľ žiadne aktivity. Pridaj prvú tlačidlom + Nová.'}
        </p>
      )}
    </section>
  )
}
