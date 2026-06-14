export function gravityWell(player, itemState) {
  itemState.wells.push({
    x: player.x - 30,
    y: player.y - 40,
    w: 80,
    h: 80,
    radius: 90,
  })
  itemState.uses -= 1
  return true
}
