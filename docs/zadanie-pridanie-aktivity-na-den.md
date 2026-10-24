# Zadanie: Pridanie existujúcej aktivity na deň (combobox)

## 1. Aktuálny stav

- Na obrazovke dňa (`TodayPage` → `QuickAdd`) je textové pole „Nová misia na tento deň“ a tlačidlo **+**.
- `addQuickTask(title, date, today)` v [src/db/days.ts](../src/db/days.ts) vždy vytvorí **novú** aktivitu s pravidlom `{ type: 'once', date }`. Pre dnešok a minulé dni hneď uloží výskyt, pre budúci deň sa výskyt iba vypočíta z pravidla.
- Pravidlo `once` je naviazané na jeden dátum (`matchesRule` porovnáva `rule.date`). Takú aktivitu sa preto nedá pridať na iný deň; každé ďalšie pridanie vytvorí duplicitnú aktivitu s rovnakým názvom.
- Ďalšie zistenia z kódu, ktoré ovplyvňujú riešenie:
  - ID výskytu je `${activityId}_${date}`, takže jedna aktivita môže mať v jeden deň najviac jeden výskyt.
  - `saveActivity` volá `dropOpenFromToday(..., includeCarried = false)`, ktorá zmaže všetky **otvorené výskyty od dneška**, ktoré nemajú `carriedFrom`. Výskyt pridaný ručne na budúci deň by sa teda po úprave aktivity stratil. Treba to ošetriť (bod 4.3).
  - `getDayView` pre budúci deň zobrazí uložené výskyty aj vypočítané z pravidiel. Ručne pridaný výskyt na budúci deň preto stačí uložiť, rovnako ako to už robí `moveOccurrence`.

## 2. Cieľ

1. Pole na pridanie misie bude **combobox**: textové pole, ktoré zároveň filtruje rozbaľovací zoznam všetkých aktivít.
2. Keď vyberiem existujúcu aktivitu a stlačím **+**, pridá sa na zvolený deň. Nevznikne nová aktivita.
3. Keď v zozname nič nenájdem, napíšem vlastný text a **+** vytvorí novú aktivitu a pridá ju na deň (ako doteraz).
4. Typ „Jednorazovo“ sa nahradí typom, ktorý vyjadruje „pridávam si ju na hocijaký deň, keď treba“, a nemá cyklus. Vo formulári nemá polia pre dátum ani čas.
5. Priorita sa dá v Nastaveniach vypnúť. Vypnutá sa nikde nezobrazuje a neovplyvňuje radenie.
6. Misiu sa dá z konkrétneho dňa odobrať akciou „Odobrať z dňa“. Aktivita a jej cyklus ostanú.

## 3. Nový typ aktivity „Podľa potreby“

### 3.1 Názov

| Návrh | Poznámka |
| --- | --- |
| **Podľa potreby** (odporúčaný) | Je jasné, že aktivita sa neopakuje sama a pridávam ju ja. |
| Kedykoľvek | Kratšie, ale znie skôr ako „môžem ju splniť kedykoľvek“. |
| Na požiadanie | Pôsobí technicky. |
| Bez opakovania | Popisuje, čo nerobí, nie na čo slúži. |

Ďalej v texte: **Podľa potreby**, interný typ `onDemand`.

### 3.2 Dátový model ([src/domain/types.ts](../src/domain/types.ts))

- Do `RecurrenceRule` pribudne `{ type: 'onDemand' }` bez dátumu.
- Typ `once` sa z modelu **odstráni**. Existujúce dáta sa zmigrujú (bod 3.4).
- `Occurrence` dostane voliteľné pole `manual?: boolean`. `true` znamená, že výskyt pridal používateľ ručne, nevznikol z pravidla.

### 3.3 Doménová logika

- `matchesRule` vráti pre `onDemand` vždy `false`, takže aktivita sa nikdy nezobrazí sama.
- `nextOccurrences` pre `onDemand` vráti prázdny zoznam.
- `describeRule`: `'Podľa potreby'`.
- `ActivityFormPage`:
  - `RULE_LABELS.onDemand = 'Podľa potreby'` (namiesto `once: 'Jednorazovo'`).
  - Pri type `onDemand` formulár **nezobrazí polia pre dátum ani čas**:
    - `RuleEditor` nič nevykreslí (odpadne pole „Dátum“, ktoré mal `once`),
    - skryjú sa polia **Od / Do**,
    - skryje sa pole **Čas (voliteľné)**.
  - Pri prepnutí na `onDemand` sa `timeOfDay` a `endDate` vymažú (`undefined`) a `startDate` ostane bez zmeny. Neviditeľné hodnoty tak neovplyvnia radenie ani zobrazenie.
  - Namiesto zoznamu „Najbližšie výskyty“ sa zobrazí text: *„Zobrazí sa iba v dni, do ktorých ju pridáš na obrazovke dňa.“*
  - Predvolené opakovanie novej aktivity ostáva `daily`.

### 3.4 Migrácia existujúcich dát

- Dexie `version(2)` s `upgrade` ([src/db/db.ts](../src/db/db.ts)), indexy sa nemenia:
  - Každá aktivita s `recurrence.type === 'once'` dostane `recurrence = { type: 'onDemand' }`.
  - Ak je `rule.date >= dnešok` a výskyt `${id}_${rule.date}` neexistuje, vytvorí sa s `status: 'open'` a `manual: true`, aby budúca jednorazová misia nezmizla.
  - Minulé dni už sú v histórii, tie sa nemenia.
- Prevod jednej aktivity bude zdieľaná funkcia (napr. `migrateOnceActivity`), aby ju použil aj import zálohy.
- **Záloha** ([src/db/backup.ts](../src/db/backup.ts)): export prejde na `version: 2`, import prijme `1` aj `2`. Pri verzii 1 sa aktivity `once` prevedú tou istou funkciou.

## 4. Pridanie aktivity na deň

### 4.1 Služby v `src/db/days.ts`

Funkcia `addQuickTask` sa nahradí dvomi:

```ts
/** Pridá existujúcu aktivitu na deň (F5). Vráti, čo sa stalo. */
addActivityToDay(activityId: string, date: ISODate, today: ISODate): Promise<'added' | 'reopened' | 'alreadyPresent'>

/** Vytvorí aktivitu „Podľa potreby“ a pridá ju na deň (F5). */
createAndAddActivity(title: string, date: ISODate, today: ISODate): Promise<void>
```

Pravidlá pre `addActivityToDay` (v jednej transakcii):

| Situácia v danom dni | Výsledok |
| --- | --- |
| Výskyt neexistuje a nie je ani vypočítaný z pravidla (budúci deň) | Uloží sa nový výskyt: `status: 'open'`, `manual: true`, `order` = počet výskytov dňa. Platí pre minulý, dnešný aj budúci deň. |
| Výskyt existuje so stavom `open` alebo `done` | Nič sa nezmení, návrat `alreadyPresent`. |
| Výskyt existuje so stavom `skipped` alebo `carried` | Stav sa vráti na `open`, nastaví sa `manual: true`, návrat `reopened`. |
| Budúci deň, aktivita v ňom vychádza z pravidla (`occursOn`) | Návrat `alreadyPresent` (v zozname už je ako náhľad). |

- Na deň sa dá pridať **aktivita akéhokoľvek typu**, nielen „Podľa potreby“. Nastavený cyklus určuje, kedy sa aktivita zobrazí sama. Ručne ju môžem pridať na hocijaký ďalší deň. Príklad: „Beh“ s opakovaním *Týždenne Po, St* pridám aj na sobotu. V sobotu sa zobrazí, cyklus sa nezmení a v pondelok a stredu sa zobrazuje ďalej ako doteraz.
- Ručne pridaný výskyt sa zobrazí bez ohľadu na `startDate`, `endDate`, `skipDates` a kvótu `timesPerWeek`. Ide o vedomú voľbu používateľa. Pri `timesPerWeek` sa splnenie ručne pridaného výskytu započíta do týždennej kvóty, rovnako ako ostatné splnené výskyty.
- `createAndAddActivity` vytvorí aktivitu ako dnešný `addQuickTask` (priorita `medium`, `carryOver` podľa nastavení), ale s `recurrence: { type: 'onDemand' }` a `startDate: date`. Potom zavolá rovnakú logiku ako `addActivityToDay`, takže aj na budúci deň sa výskyt uloží.

### 4.2 Prenos na ďalší deň

Bez zmeny. `materializeDay` prenesie otvorený ručný výskyt podľa `activity.carryOver`. Prenesený výskyt dostane `carriedFrom` a ďalej sa správa ako doteraz.

### 4.3 Ochrana ručných výskytov

`dropOpenFromToday` (volá ju `saveActivity`) **nesmie mazať výskyty s `manual: true`**. Filter sa zmení na:

```ts
o.status === 'open' && !o.manual && (includeCarried || !o.carriedFrom)
```

`deleteActivity` naďalej zmaže všetky otvorené výskyty od dneška, ručné aj prenesené. Iba pri `deleteActivity` sa `includeCarried` rozšíri aj na `manual`.

### 4.4 Odobrať z dňa

Nová služba:

```ts
/** Odoberie aktivitu z daného dňa; aktivita ani jej cyklus sa nemaže. */
removeFromDay(activityId: string, date: ISODate): Promise<void>
```

Pravidlá (v jednej transakcii nad `activities` a `occurrences`):

| Situácia | Výsledok |
| --- | --- |
| Uložený výskyt so stavom `open` alebo `skipped` | Výskyt sa **zmaže**. |
| Aktivita v ten deň vychádza z cyklu (`matchesRule` pre daný dátum je `true`) | Okrem toho sa dátum pridá do `activity.skipDates`. Inak by `materializeDay` výskyt znova vytvoril (dnešok) alebo by sa znova zobrazil v náhľade (budúci deň). |
| Budúci deň, výskyt je iba vypočítaný z cyklu (nie je uložený) | Iba sa dátum pridá do `skipDates`. |
| Výskyt so stavom `done` alebo `carried` | Akcia nie je dostupná. Splnená misia patrí do histórie: najprv ju treba odškrtnúť. Presunutá misia je záznam o presune. |

- Pre `matchesRule` sa nepoužije `occursOn`, lebo ten už `skipDates` zohľadňuje. Pri `timesPerWeek` je kandidátom každý deň, takže sa dátum do `skipDates` pridá vždy.
- Výskyt prenesený z predchádzajúceho dňa (`carriedFrom`) sa zmaže rovnako. Pôvodný deň ostane so stavom `carried`.
- Neskoršie ručné pridanie (`addActivityToDay`) na ten istý deň funguje ďalej. Ručný výskyt sa zobrazí bez ohľadu na `skipDates` (bod 4.1), takže `skipDates` netreba upravovať.
- Bez potvrdzovacieho dialógu: akcia je ľahko vratná opätovným pridaním cez combobox.

## 5. UI: combobox na obrazovke dňa

Komponent `QuickAdd` v [src/pages/TodayPage.tsx](../src/pages/TodayPage.tsx) sa nahradí komponentom `ActivityCombobox` (vlastný komponent v `src/components/`, bez novej knižnice). Natívny `<datalist>` nevyhovuje: v iOS Safari sa nedá naštýlovať, nepodporuje zakázané položky ani doplnkový text.

### 5.1 Rozloženie

```
[ Vyber alebo napíš misiu…            ▾ ] [ + ]
  ┌───────────────────────────────────────┐
  │ Beh              Pracovné dni         │
  │ Kúpiť chlieb     Podľa potreby        │
  │ Cvičenie         už je v tomto dni    │  ← zakázaná
  │ ＋ Vytvoriť „Kúp“                      │  ← iba ak nie je presná zhoda
  └───────────────────────────────────────┘
```

- Placeholder: **„Vyber alebo napíš misiu“**.
- Položka zoznamu: názov, vpravo menším písmom `describeRule(recurrence)`.
- Zoznam ponúka **všetky aktivity všetkých typov** (denné, týždenné, mesačné, ročné, pracovné dni, víkendy, N× za týždeň aj „Podľa potreby“). Typ ani cyklus neobmedzuje, či sa aktivita dá vybrať.
- Zoradenie: podľa názvu (`localeCompare(..., 'sk')`), bez delenia podľa typu.
- Zakázaná je jediná situácia: aktivita už je **v tomto konkrétnom dni** (stav `open`/`done`, alebo budúci náhľad z pravidla). Taká položka má text „už je v tomto dni“. Dá sa to určiť z `items` z `getDayView`, netreba ďalší dotaz. Tá istá aktivita sa v iný deň, kde ešte nie je, dá vybrať normálne.
- Zoznam sa otvorí po kliknutí alebo fokuse na pole a pri písaní. Zatvorí sa klávesou Esc, klikom mimo alebo po výbere. Má max. výšku ~5 položiek a vlastný scroll. Otvára sa **nad** poľom, ak by pod ním nebolo miesto (pole je na konci stránky a na mobile ho prekryje klávesnica).
- Prázdny stav (žiadne aktivity): zoznam sa nezobrazí a pole funguje ako doteraz.

### 5.2 Filtrovanie

- Podreťazec v názve, bez ohľadu na veľkosť písmen a **diakritiku** (`normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()`), napr. „kup“ nájde „Kúpiť chlieb“.
- Ak text nie je prázdny a žiadna aktivita sa s ním presne nezhoduje (po normalizácii a `trim`), na konci zoznamu je položka **„＋ Vytvoriť „{text}““**.

### 5.3 Výber a tlačidlo +

- Klik alebo Enter na položku zoznamu vyberie aktivitu: pole zobrazí jej názov a stav komponentu si drží `selectedId`.
- Keď používateľ po výbere zmení text, výber sa zruší (`selectedId = undefined`).
- **+** (aj Enter, ak nie je zvýraznená žiadna položka):
  1. ak je `selectedId` → `addActivityToDay`,
  2. inak, ak sa text presne zhoduje s názvom aktivity (normalizovane), použije sa tá. Pri viacerých zhodách má prednosť „Podľa potreby“, potom prvá podľa abecedy. Tým nevznikajú duplicitné aktivity → `addActivityToDay`,
  3. inak → `createAndAddActivity(text)`.
- Tlačidlo je zakázané pri prázdnom texte a pri výbere aktivity, ktorá už v dni je.
- Po úspechu sa pole vyprázdni, zoznam zavrie a fokus ostane v poli, aby sa dalo pridávať ďalej.
- Výsledok `alreadyPresent` (napr. pri presnej zhode v kroku 2) zobrazí krátku hlášku „Misia už je v tomto dni“. Využije sa existujúci `ErrorToast` alebo text pod poľom.
- `aria-label` tlačidla: „Pridať misiu na tento deň“.

### 5.4 Klávesnica a prístupnosť

- Pole: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`. Zoznam: `role="listbox"`, položky `role="option"` s `aria-disabled`.
- ↓ / ↑ pohyb po položkách (zakázané preskakuje), Enter vyberie, Esc zavrie.
- `enterKeyHint="done"`, `autoComplete="off"`.
- Ťuknutie na položku na mobile nesmie zavrieť zoznam skôr, ako sa vyberie (`onMouseDown`/`onPointerDown` s `preventDefault`).

### 5.5 Platnosť pre dni

Combobox je dostupný v minulých, dnešnom aj budúcich dňoch, ako dnes `QuickAdd`. Na budúci deň sa pridaná misia zobrazí v náhľade (iba na čítanie, ako ostatné budúce misie).

### 5.6 Akcia „Odobrať z dňa“ v menu misie

- V menu **⋯** (`TaskRow` v [TodayPage.tsx](../src/pages/TodayPage.tsx)) pribudne tlačidlo **„Odobrať z dňa“**. Zobrazí sa pri misiách so stavom `open` alebo `skipped`, v minulých, dnešnom aj budúcich dňoch.
- Pri budúcich dňoch dnes menu chýba (`readOnly`). Nové: tlačidlo ⋯ zobrazí aj tam, ale menu ponúkne **iba** „Odobrať z dňa“. Odškrtnutie ostáva zakázané. Platí to aj pre misie, ktoré sú len náhľadom z cyklu a nemajú uložený výskyt.
- Po kliknutí sa zavolá `removeFromDay(activity.id, date)`. Misia zo zoznamu zmizne (`useLiveQuery`) a ukazovateľ „Splnené misie“ sa prepočíta.
- Po odobratí je aktivita v comboboxe pre ten deň znova dostupná (nie je zakázaná).

## 6. Priorita ako voliteľná funkcia

Priorita (rank A/B/C) sa **neodstráni**. V Nastaveniach pribudne prepínač, ktorým sa zapína a vypína pre celú aplikáciu. Dáta o priorite ostávajú uložené aj pri vypnutí, takže po opätovnom zapnutí sa nič nestratí.

### 6.1 Nastavenie

- `Settings` ([src/domain/types.ts](../src/domain/types.ts)) dostane pole `usePriority: boolean`.
- V `DEFAULTS` ([src/db/settings.ts](../src/db/settings.ts)) bude `usePriority: true`, aby sa po aktualizácii správanie nezmenilo. Netreba migráciu: `getSettings` doplní predvolenú hodnotu.
- [src/pages/SettingsPage.tsx](../src/pages/SettingsPage.tsx): nový riadok s checkboxom v rovnakom štýle ako „Preniesť nesplnenú na ďalší deň“, s textom **„Používať prioritu (rank A/B/C)“**. Zmena sa uloží cez `updateSettings({ usePriority })`.
- Záloha: nastavenie sa exportuje a importuje spolu s ostatnými nastaveniami. Pri staršej zálohe bez poľa platí predvolená hodnota.

### 6.2 Správanie pri vypnutej priorite

| Miesto | Zapnutá (dnešný stav) | Vypnutá |
| --- | --- | --- |
| Formulár aktivity ([ActivityFormPage.tsx](../src/pages/ActivityFormPage.tsx)) | Pole **Priorita** vedľa poľa **Čas** | Pole sa skryje a **Čas** zaberie celý riadok. Uložená priorita aktivity sa nemení, nová aktivita dostane `medium`. |
| Obrazovka dňa ([TodayPage.tsx](../src/pages/TodayPage.tsx)) | `RankBadge` pred názvom | Bez odznaku |
| Zoznam Aktivít ([ActivitiesPage.tsx](../src/pages/ActivitiesPage.tsx)) | `RankBadge` pred názvom | Bez odznaku |
| Combobox (kap. 5) | `RankBadge` pred názvom položky | Bez odznaku |
| Radenie misií v dni (`compareItems` v [days.ts](../src/db/days.ts)) | čas → priorita → názov | čas → názov. Skrytá vlastnosť nesmie ovplyvňovať poradie. |

- `getDayView` dostane parameter `usePriority`. Komponenty čítajú nastavenie cez `useLiveQuery(getSettings)`, ako dnes `ActivityFormPage`.
- Kým sa nastavenia načítavajú, UI sa správa ako pri zapnutej priorite (predvolená hodnota).
- Pri type „Podľa potreby“ sa priorita správa rovnako ako pri ostatných typoch. Skrýva sa iba Dátum, Čas a Od/Do (bod 3.3).

## 7. Testy

**Unit (Vitest)**
- `recurrence.test.ts`: `onDemand` sa nevyskytne v žiadny deň; `nextOccurrences` je prázdne. Test `once` sa nahradí.
- `days.test.ts`:
  - `addActivityToDay` pre minulý, dnešný a budúci deň uloží výskyt s `manual: true`;
  - druhé pridanie vráti `alreadyPresent` a nevytvorí duplikát;
  - pri `skipped`/`carried` sa stav vráti na `open`;
  - budúci deň s výskytom z pravidla vráti `alreadyPresent`;
  - `saveActivity` nezmaže ručný výskyt na budúci deň, `deleteActivity` áno;
  - ručný výskyt sa prenesie na ďalší deň podľa `carryOver`;
  - `createAndAddActivity` na budúci deň vytvorí aktivitu `onDemand` a uložený výskyt.
  - `removeFromDay`: ručný výskyt mimo cyklu sa zmaže a `skipDates` sa nezmení; výskyt z cyklu sa zmaže, dátum pribudne do `skipDates` a opakované `materializeDay` ho nevytvorí; budúci náhľad z cyklu zmizne z `getDayView`; po odobratí funguje `addActivityToDay` na ten istý deň;
  - Existujúce testy s `type: 'once'` sa prepíšu.
- `db.test.ts`: migrácia v2. `once` s budúcim dátumom → `onDemand` + výskyt; `once` s minulým dátumom → iba zmena typu.
- `days.test.ts`: so zapnutou prioritou radenie čas → priorita → názov, s vypnutou čas → názov.
- Nastavenia: `getSettings` bez uloženého `usePriority` vráti `true`.
- `backup.test.ts`: import zálohy verzie 1 s `once` prevedie typ.
- Filter: normalizácia diakritiky (čistá funkcia, napr. v `src/domain/`).

**E2E (Playwright)**: v `e2e/today.spec.ts` treba upraviť placeholder a pridať scenáre:
- napíšem nový text → + → misia je v dni a v Aktivitách ako „Podľa potreby“;
- prejdem na zajtra, otvorím zoznam, vyberiem tú istú aktivitu → + → misia je v zajtrajšom náhľade;
- týždennú aktivitu (napr. Po) pridám na deň mimo cyklu → misia je v tom dni a v pondelok ostáva ako doteraz;
- písanie filtruje zoznam aj bez diakritiky;
- aktivita, ktorá už v dni je, je v zozname zakázaná;
- misiu pridanú omylom odoberiem cez ⋯ → „Odobrať z dňa“ → zmizne a dá sa znova vybrať v comboboxe;
- na budúcom dni odoberiem misiu z cyklu → zmizne z náhľadu, v ďalších dňoch cyklu ostáva;
- vo formulári aktivity po výbere „Podľa potreby“ nie sú polia Dátum, Čas, Od ani Do;
- po vypnutí priority v Nastaveniach zmizne pole Priorita vo formulári aj odznaky ranku v dni a v Aktivitách; po zapnutí sa vrátia s pôvodnými hodnotami.

## 8. Mimo rozsahu / otvorené otázky

1. **Zobrazenie v zozname Aktivít**: zobrazovať pri „Podľa potreby“ aj počet alebo dátum posledného použitia? Navrhujem zatiaľ nie.