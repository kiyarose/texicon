export function bombPlatform(player, itemState, chunk) {
  chunk.props.push({
    id: `bomb-${Date.now()}`,
    kind: "bomb",
    x: player.x + player.facing * 24,
    y: player.y + player.h - 4,
    w: 20,
    h: 20,
    fuse: 60,
  })
  itemState.uses -= 1
  return true
}
