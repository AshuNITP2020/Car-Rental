import { useEffect, useState } from 'react'

/** The value as of `ms` ago — updates settle after the caller stops changing it
 *  (typeahead queries shouldn't fire per keystroke). */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}
