import { useEffect, useState, type DependencyList } from 'react';
import { onDbChange } from '../db/db';

/** Wynik zapytania do bazy, odświeżany automatycznie po każdej zmianie w bazie. */
export function useLive<T>(query: () => Promise<T>, deps: DependencyList, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    const run = () => {
      query()
        .then((v) => alive && setValue(v))
        .catch((e) => console.error(e));
    };
    run();
    const off = onDbChange(run);
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** Aktualny czas, odświeżany co `ms` (domyślnie co 30 s). */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const h = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(h);
  }, [ms]);
  return now;
}
