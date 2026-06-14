import { physics as PHYSICS } from "../lol/config.js"
import { aabb } from "./physics_collision.js"

export function stepCrates(props, solids, walls, dt) {
  const crates = props
    .filter((c) => c.kind === "crate" && !c.detonated)
    .sort((a, b) => b.y - a.y)

  for (const crate of crates) {
    crate.vx = (crate.vx || 0) * Math.pow(0.88, dt)
    crate.vy = (crate.vy || 0) + PHYSICS.gravity * dt

    const prevY = crate.y
    crate.x += (crate.vx || 0) * dt
    crate.y += (crate.vy || 0) * dt
    crate.onGround = false

    for (const wall of walls) {
      if (!aabb(crate, wall)) continue
      if (crate.x + crate.w / 2 < wall.x + wall.w / 2) {
        crate.x = wall.x - crate.w
      } else {
        crate.x = wall.x + wall.w
      }
      crate.vx = 0
    }

    for (const plat of solids) {
      resolveCrateLanding(crate, plat, prevY)
    }

    for (const other of crates) {
      if (other === crate) continue
      resolveCrateLanding(crate, other, prevY)
      resolveCrateSides(crate, other)
    }

    crate.x = clamp(crate.x, 16, 960 - crate.w - 16)
  }
}

function resolveCrateLanding(crate, surface, prevY) {
  if (!aabb(crate, surface)) return

  const feet = crate.y + crate.h
  const prevFeet = prevY + crate.h
  const top = surface.y
  const overlapX = crate.x + crate.w > surface.x + 4 && crate.x < surface.x + surface.w - 4

  if (crate.vy >= 0 && overlapX && feet >= top - 1 && prevFeet <= top + (surface.h || 14) + 8) {
    crate.y = top - crate.h
    crate.vy = 0
    crate.vx *= 0.55
    crate.onGround = true
    return
  }

  if (crate.vy < 0 && overlapX && crate.y <= top + (surface.h || 14) && prevY >= top) {
    crate.y = top + (surface.h || 14)
    crate.vy = 0
  }
}

function resolveCrateSides(crate, other) {
  if (!aabb(crate, other)) return

  const overlapTop = crate.y + crate.h - other.y
  if (overlapTop < 12 && crate.vy >= 0) return

  if (crate.x + crate.w / 2 < other.x + other.w / 2) {
    crate.x = other.x - crate.w
  } else {
    crate.x = other.x + other.w
  }
  crate.vx = 0
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}
