export function pushBlock(player, itemState, chunk) {
  chunk.props.push({
    id: `spawn-${Date.now()}`,
    kind: "crate",
    x: player.x + player.facing * 30,
    y: player.y,
    w: 28,
    h: 28,
    vx: player.facing * 2,
    vy: -2,
  })
  itemState.uses -= 1
  return true
}
