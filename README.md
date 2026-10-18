# Denný To-Do

Offline PWA pre denný to-do list s opakovanými aktivitami a históriou. Beží na iPhone (Safari) aj Androide (Chrome), dáta sú iba v zariadení (IndexedDB).

Stack: React + TypeScript, Vite, vite-plugin-pwa, Dexie, Tailwind CSS, React Router, date-fns, Vitest, Playwright (WebKit).

## Príkazy

| Príkaz | Čo robí |
| --- | --- |
| `npm run dev` | vývojový server |
| `npm test` | unit testy (Vitest) |
| `npm run test:e2e` | testy UI v jadre WebKit (prvýkrát `npx playwright install webkit`) |
| `npm run build` | produkčný build do `dist/` |
| `npm run preview` | spustí build lokálne – offline režim a inštalácia fungujú len tu, nie v `dev` |
| `npm run icons` | vygeneruje PNG ikony z `public/favicon.svg` |

## Štruktúra

- `src/domain/` – typy, práca s dátumami, výpočet opakovania (čistá logika, testovaná Vitestom)
- `src/db/` – Dexie schéma IndexedDB
- `src/pages/` – obrazovky Dnes, Kalendár, Aktivity, Nastavenia
- `src/components/` – zdieľané komponenty (spodná navigácia)

## Inštalácia na iPhone

1. Nasadiť `dist/` na GitHub Pages (build s `BASE_PATH=/<repozitár>/`).
2. Otvoriť adresu v Safari → Zdieľať → Pridať na plochu.
