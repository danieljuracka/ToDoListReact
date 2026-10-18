import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { migrateLegacyDb, requestPersistentStorage } from './db/db'
import { router } from './router'
import './index.css'

// Aplikácia sa vykreslí až po presune starých dát, aby nič nezačalo zapisovať do prázdnej databázy.
void migrateLegacyDb()
  .catch((error: unknown) => console.error('Migrácia databázy zlyhala', error))
  .finally(() => {
    void requestPersistentStorage()
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    )
  })
