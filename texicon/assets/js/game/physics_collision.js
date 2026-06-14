export function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h >= b.y
  )
}

export function feetOnPlatform(player, plat) {
  const feet = player.y + player.h
  return (
    player.x + player.w > plat.x &&
    player.x < plat.x + plat.w &&
    feet >= plat.y - 1 &&
    feet <= plat.y + plat.h + 2
  )
}
