function findGrappleTarget(player, chunk) {
  let best = null
  let bestDist = Infinity
  const px = player.x + player.w / 2
  const py = player.y + player.h / 2

  for (const c of [...(chunk.platforms || []), ...(chunk.walls || [])]) {
    if (c.removed) continue
    const cx = c.x + c.w / 2
    const cy = c.y
    const d = Math.hypot(cx - px, cy - py)
    if (d < bestDist && d < 180) {
      bestDist = d
      best = { x: cx - player.w / 2, y: cy - player.h - 4 }
    }
  }

  return best
}

export function grappleLine(player, itemState, chunk) {
  const target = findGrappleTarget(player, chunk)
  if (!target) return false
  player.vx = (target.x - player.x) * 0.08
  player.vy = (target.y - player.y) * 0.08
  itemState.uses -= 1
  return true
}
