export function shouldDropThrough(player, plat, input) {
  return plat.kind === "oneway" && input.down && player.y + player.h <= plat.y + plat.h + 4
}

export function skipVerticalLanding(player, plat, input) {
  if (plat.kind !== "oneway") return false
  if (shouldDropThrough(player, plat, input)) return true
  return player.y + player.h - player.vy > plat.y + 8
}

export function drawOverlay(ctx, plat, x, y, w, h, scale) {
  ctx.strokeStyle = "rgba(255,255,255,0.45)"
  ctx.setLineDash([4 * scale, 4 * scale])
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  const cx = x + w / 2
  ctx.beginPath()
  ctx.moveTo(cx, y + 6 * scale)
  ctx.lineTo(cx - 5 * scale, y + 2 * scale)
  ctx.lineTo(cx + 5 * scale, y + 2 * scale)
  ctx.closePath()
  ctx.fill()
}
