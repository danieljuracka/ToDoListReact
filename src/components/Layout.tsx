import { NavLink, Outlet } from 'react-router'

const tabs = [
  { to: '/', label: 'Dnes', end: true },
  { to: '/kalendar', label: 'Kalendár' },
  { to: '/aktivity', label: 'Aktivity' },
  { to: '/nastavenia', label: 'Nastavenia' },
]

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)]">
      <main className="flex-1 px-4 pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <ul className="mx-auto flex max-w-md">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `block py-3 text-center text-sm font-medium ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
