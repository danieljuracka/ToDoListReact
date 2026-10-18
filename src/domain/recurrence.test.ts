import { describe, it } from 'vitest'

describe('occursOn', () => {
  it.todo('jednorazová aktivita sa zobrazí iba v zadaný deň')
  it.todo('denne s intervalom 2 sa zobrazí každý druhý deň od startDate')
  it.todo('týždenne Po, St, Pi sa zobrazí presne v tieto dni')
  it.todo('mesačne 31. sa v kratšom mesiaci nezobrazí (alebo sa posunie na posledný deň – rozhodnúť)')
  it.todo('mesačne posledný piatok nájde správny deň')
  it.todo('ročne 29. februára v nepriestupnom roku')
  it.todo('pracovné dni a víkendy')
  it.todo('nezobrazí sa pred startDate ani po endDate')
  it.todo('nezobrazí sa v dátume zo skipDates')
  it.todo('N-krát za týždeň sa zobrazuje, kým nie je kvóta splnená')
})
