import { useEffect, useState } from 'react'
import { materializeUpTo } from '@/db/days'
import { todayISO } from '@/domain/dates'
import type { ISODate } from '@/domain/types'

/**
 * Aktuálny deň. Na iPhone ostáva PWA v pamäti aj cez polnoc, preto sa deň
 * prepočíta pri návrate do aplikácie a raz za minútu.
 */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO)

  useEffect(() => {
    const update = () => {
      const now = todayISO()
      setToday(now)
      void materializeUpTo(now)
    }
    update()
    const timer = setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return today
}
