export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function mixSeed(seed: number, index: number): number {
  const mixed = Math.imul(seed ^ Math.imul(index + 1, 0x9e3779b1), 0x85ebca6b)
  return mixed >>> 0
}

export function pickIndex(length: number, seed: number): number {
  if (length <= 0) return 0
  const rng = mulberry32(seed)
  return Math.floor(rng() * length)
}
