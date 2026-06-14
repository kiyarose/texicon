import { PHYSICS } from "../physics.js"

export function onLand(player, plat) {
  player.vy = PHYSICS.jumpVel * PHYSICS.bouncyMult
  player.onGround = false
  return { bounced: true }
}

export function drawOverlay(ctx, _plat, x, y, w, _h, scale) {
  ctx.fillStyle = "rgba(255,255,255,0.25)"
  ctx.fillRect(x + 4 * scale, y + 2 * scale, w - 8 * scale, 3 * scale)
}
