import { useEffect, useState } from 'react'

/** Zobrazí nezachytené chyby priamo v aplikácii, aby boli vidieť aj na telefóne bez konzoly. */
export function ErrorToast() {
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    const show = (error: unknown) => {
      const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      setMessage(text)
    }
    const onError = (e: ErrorEvent) => show(e.error ?? e.message)
    const onRejection = (e: PromiseRejectionEvent) => show(e.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (!message) return null

  return (
    <div
      role="alert"
      className="shape fixed inset-x-4 bottom-24 z-50 border-2 border-line bg-danger p-3 text-sm text-surface shadow-ink"
    >
      <div className="font-bold">Niečo sa pokazilo</div>
      <div className="mt-1 break-words">{message}</div>
      <button className="mt-2 font-bold underline" onClick={() => setMessage(undefined)}>
        Zavrieť
      </button>
    </div>
  )
}
