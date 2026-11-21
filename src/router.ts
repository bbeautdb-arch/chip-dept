import { useEffect, useState } from 'react'

export function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/'
  const [path, q] = h.split('?')
  return { path, q: new URLSearchParams(q ?? '') }
}
export function useRoute() {
  const [r, setR] = useState(parseHash)
  useEffect(() => {
    const f = () => { setR(parseHash()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}
export const go = (to: string) => { location.hash = to }
