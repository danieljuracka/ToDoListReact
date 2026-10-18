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
      <main className="flex-1 px-4 pb-28">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-accent bg-line pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-md">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `block py-3.5 text-center text-xs font-bold tracking-wider uppercase ${
                    isActive ? 'bg-accent/15 text-accent' : 'text-paper/60'
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
