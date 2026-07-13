/** Deterministic gradient per car so imageless listings still look designed. */
export function carPlaceholderStyle(id: number) {
  const hue = (id * 137) % 360
  return {
    background: `linear-gradient(135deg, hsl(${hue} 62% 50%), hsl(${(hue + 45) % 360} 68% 38%))`,
  }
}
