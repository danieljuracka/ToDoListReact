import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { ErrorToast } from './ErrorToast'
import { UpdateBanner } from './UpdateBanner'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const tabs = [
  {
    to: '/',
    label: 'Dnes',
    end: true,
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </Icon>
    ),
  },
  {
    to: '/kalendar',
    label: 'Kalendár',
    icon: (
      <Icon>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </Icon>
    ),
  },
  {
    to: '/aktivity',
    label: 'Aktivity',
    icon: (
      <Icon>
        <path d="M10 6h10M10 12h10M10 18h10" />
        <path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
      </Icon>
    ),
  },
  {
    to: '/nastavenia',
    label: 'Nastavenia',
    icon: (
      <Icon>
        <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
        <circle cx="15" cy="6" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="17" cy="18" r="2" />
      </Icon>
    ),
  },
]

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)]">
      <main className="flex-1 px-4 pb-28">
        <Outlet />
      </main>
      <ErrorToast />
      <UpdateBanner />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-accent bg-line pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                aria-label={tab.label}
                className={({ isActive }) =>
                  `flex items-center justify-center gap-2 py-3.5 text-xs font-bold tracking-wider uppercase ${
                    isActive ? 'bg-accent/15 text-accent' : 'text-paper/60'
                  }`
                }
              >
                {tab.icon}
                {/* Na úzkej obrazovke iba ikona, popis od šírky 640 px */}
                <span className="hidden sm:inline">{tab.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
