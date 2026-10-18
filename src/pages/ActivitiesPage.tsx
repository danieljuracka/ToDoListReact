import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { RankBadge } from '@/components/Ninja'
import { buttonPrimary } from '@/components/ui'
import { db } from '@/db/db'
import { describeRule } from '@/domain/describe'

export function ActivitiesPage() {
  const activities = useLiveQuery(() => db.activities.toArray(), [])
  const sorted = (activities ?? []).sort((a, b) => a.title.localeCompare(b.title, 'sk'))

  return (
    <section className="pt-4">
      <div className="flex items-center justify-between">
        <h1 className="heading text-2xl">Aktivity</h1>
        <Link to="/aktivity/nova" className={buttonPrimary} aria-label="Nová aktivita">
          +<span className="hidden sm:inline"> Nová</span>
        </Link>
      </div>

      <ul className="mt-4 space-y-2">
        {sorted.map((a) => (
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

      {activities && sorted.length === 0 && (
        <p className="mt-6 text-muted">Zatiaľ žiadne aktivity. Pridaj prvú tlačidlom +.</p>
      )}
    </section>
  )
}
