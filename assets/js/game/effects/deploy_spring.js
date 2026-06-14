export function deploySpring(player, itemState, chunk) {
  if (!player.onGround) return false

  const solids = (chunk?.platforms || []).filter((p) => p.kind !== "wall" && !p.removed)
  const feetY = player.y + player.h
  const standPlat = solids.find(
    (plat) =>
      feetY >= plat.y - 2 &&
      feetY <= plat.y + 6 &&
      player.x + player.w > plat.x + 2 &&
      player.x < plat.x + plat.w - 2
  )

  if (!standPlat) return false

  const padW = 40
  const padH = 8
  const facing = player.facing || 1
  const padX = Math.max(
    standPlat.x + 4,
    Math.min(player.x + facing * 20, standPlat.x + standPlat.w - padW - 4)
  )

  player.deployed.push({
    kind: "spring_pad",
    x: padX,
    y: standPlat.y - padH,
    w: padW,
    h: padH,
  })
  itemState.uses -= 1
  return true
}
