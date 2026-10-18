import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { RankBadge } from '@/components/Ninja'
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
        <h1 className="heading text-2xl">Aktivity</h1>
        <Link to="/aktivity/nova" className={buttonPrimary}>
          + Nová
        </Link>
      </div>

      <div className="shape-sm mt-4 flex border-2 border-line bg-surface p-1 text-xs font-bold tracking-wider uppercase shadow-ink">
        {[false, true].map((archived) => (
          <button
            key={String(archived)}
            onClick={() => setShowArchived(archived)}
            className={`shape-sm flex-1 py-2 font-semibold ${
              showArchived === archived ? 'bg-accent text-surface' : 'text-muted'
            }`}
          >
            {archived ? 'Archivované' : 'Aktívne'}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {visible.map((a) => (
          <li key={a.id}>
            <Link to={`/aktivity/${a.id}`} className="block panel p-3">
              <div className="flex items-center gap-2 font-bold">
                <RankBadge priority={a.priority} />
                {a.title}
              </div>
              <div className="text-sm text-muted">
                {[describeRule(a.recurrence), a.timeOfDay, a.carryOver && 'prenáša sa'].filter(Boolean).join(' · ')}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {activities && visible.length === 0 && (
        <p className="mt-6 text-muted">
          {showArchived ? 'Žiadne archivované aktivity.' : 'Zatiaľ žiadne aktivity. Pridaj prvú tlačidlom + Nová.'}
        </p>
      )}
    </section>
  )
}
