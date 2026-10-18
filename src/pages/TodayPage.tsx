import { useParams } from 'react-router'
import { formatDayTitle, todayISO } from '@/domain/dates'

export function TodayPage() {
  const { date = todayISO() } = useParams()

  return (
    <section className="pt-4">
      <h1 className="text-2xl font-bold first-letter:uppercase">{formatDayTitle(date)}</h1>
      {/* TODO: progress bar, zoznam výskytov, odškrtnutie, swipe, rýchle pridanie (F3, F5) */}
      <p className="mt-6 text-slate-500">Na tento deň zatiaľ nie sú žiadne úlohy.</p>
    </section>
  )
}
