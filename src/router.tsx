import { createHashRouter } from 'react-router'
import { Layout } from './components/Layout'
import { ActivitiesPage } from './pages/ActivitiesPage'
import { CalendarPage } from './pages/CalendarPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'

// Hash router (#/kalendar), aby obnovenie stránky fungovalo aj na GitHub Pages bez servera.
export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'den/:date', element: <TodayPage /> },
      { path: 'kalendar', element: <CalendarPage /> },
      { path: 'aktivity', element: <ActivitiesPage /> },
      { path: 'nastavenia', element: <SettingsPage /> },
    ],
  },
])
