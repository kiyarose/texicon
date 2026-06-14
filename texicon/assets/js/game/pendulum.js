export function pendulumFrozen(prop, itemState = {}) {
  return prop.frozen || (itemState.frozenUntil && Date.now() < itemState.frozenUntil)
}

export function pendulumSwing(prop, time, itemState = {}) {
  if (pendulumFrozen(prop, itemState)) return 0
  return Math.sin(time * 2 + prop.x) * 30
}

export function pendulumBob(prop, time, itemState = {}) {
  const swing = pendulumSwing(prop, time, itemState)
  const cx = prop.x + prop.w / 2 + swing
  const cy = prop.y + 60
  const r = 12

  prop._bobCx = cx
  prop._bobCy = cy
  prop._bobSwing = swing

  return { cx, cy, r, swing }
}

export function pendulumSurface(prop, time, itemState = {}) {
  const { cx, cy, r } = pendulumBob(prop, time, itemState)

  return {
    id: `pend-surface-${prop.id}`,
    kind: "pendulum_bob",
    x: cx - 10,
    y: cy - r,
    w: 20,
    h: 6,
    pendulumRef: prop,
  }
}

export function collectPendulumSolids(props, time, itemState = {}) {
  const solids = []

  for (const prop of props || []) {
    if (prop.kind !== "pendulum" || prop.detonated) continue
    solids.push(pendulumSurface(prop, time, itemState))
  }

  return solids
}

export function playerOnPendulumTop(player, prop, time, itemState = {}) {
  const { cx, cy, r } = pendulumBob(prop, time, itemState)
  const surfaceY = cy - r
  const feet = player.y + player.h

  return (
    feet >= surfaceY - 4 &&
    feet <= surfaceY + 14 &&
    player.x + player.w > cx - 12 &&
    player.x < cx + 12
  )
}

export function carryPlayerOnPendulums(player, props) {
  for (const prop of props || []) {
    if (prop.kind !== "pendulum" || prop._bobCx == null) continue

    const prev = prop._prevBobCx ?? prop._bobCx
    const dx = prop._bobCx - prev
    prop._prevBobCx = prop._bobCx

    const surface = {
      x: prop._bobCx - 10,
      y: prop._bobCy - 12,
      w: 20,
      h: 6,
    }

    const feet = player.y + player.h
    if (
      feet >= surface.y - 2 &&
      feet <= surface.y + 8 &&
      player.x + player.w > surface.x + 2 &&
      player.x < surface.x + surface.w - 2 &&
      player.vy >= -1
    ) {
      player.x += dx
    }
  }
}
