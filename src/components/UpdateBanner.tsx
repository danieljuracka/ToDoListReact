import { useRegisterSW } from 'virtual:pwa-register/react'
import { buttonPrimary, buttonSecondary } from './ui'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Pravidelne kontroluje novú verziu aplikácie a ponúkne jej načítanie.
 * Aplikácia pridaná na plochu sa často iba obnoví z pamäte, preto kontrolujeme
 * aj pri každom návrate do popredia, nielen pri štarte.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      const check = async () => {
        if (registration.installing || !navigator.onLine) return
        try {
          await registration.update()
        } catch {
          // Bez spojenia so serverom skúsime nabudúce
        }
      }
      setInterval(check, CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void check()
      })
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="shape fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-50 mx-auto max-w-2xl border-2 border-line bg-surface p-3 text-sm text-ink shadow-ink"
    >
      <div className="font-bold">Nová verzia je dostupná</div>
      <div className="mt-3 flex gap-2">
        <button className={buttonPrimary} onClick={() => void updateServiceWorker(true)}>
          Aktualizovať
        </button>
        <button className={buttonSecondary} onClick={() => setNeedRefresh(false)}>
          Neskôr
        </button>
      </div>
    </div>
  )
}
