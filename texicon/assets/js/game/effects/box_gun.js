export function boxGun(player, itemState, chunk) {
  const range = 120
  const cy = player.y + player.h / 2
  let target = null
  let bestDist = Infinity

  for (const plat of chunk.platforms || []) {
    if (plat.removed || plat.kind === "spawn" || plat.id === "spawn") continue
    const px = plat.x + plat.w / 2
    const dx = px - (player.x + player.w / 2)
    if (player.facing !== 0 && Math.sign(dx) !== player.facing) continue
    const d = Math.hypot(dx, plat.y + plat.h / 2 - cy)
    if (d < range && d < bestDist) {
      bestDist = d
      target = plat
    }
  }

  if (!target) return false

  chunk.props.push({
    id: `crate-${Date.now()}`,
    kind: "crate",
    x: target.x + target.w / 2 - 14,
    y: target.y - 28,
    w: 28,
    h: 28,
    vx: 0,
    vy: 0,
  })
  target.removed = true
  itemState.uses -= 1
  return true
}
