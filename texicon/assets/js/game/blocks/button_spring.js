import { PHYSICS } from "../physics.js"

export function onLand(player, plat, chunk) {
  if (plat.triggered) return null
  plat.triggered = true
  chunk.props = chunk.props || []
  chunk.props.push({
    id: `btn-spring-${plat.id || Date.now()}`,
    kind: "spring",
    x: plat.x + plat.w / 2 - 14,
    y: plat.y - 32,
    w: 28,
    h: 28,
  })
  player.vy = PHYSICS.jumpVel * 1.2
  player.onGround = false
  return { sprung: true }
}

export function drawOverlay(ctx, plat, x, y, w, h, scale) {
  ctx.fillStyle = "#ef476f"
  ctx.fillRect(x + w * 0.3, y + h * 0.35, w * 0.4, h * 0.3)
}
