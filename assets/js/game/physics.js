import {
  skipVerticalLanding,
  onPlatformLand,
  onPropTouch,
  updateMovingPlatforms,
  applyGravityZones,
  checkLethalTouch,
  useItemBehavior,
  applyPassiveBehaviors,
  tickItemState,
  checkPendulumHit,
  behaviorList,
  paramsFor,
} from "./behaviors/engine.js"
import { physics as PHYSICS } from "../lol/config.js"
import { aabb, feetOnPlatform } from "./physics_collision.js"

export { PHYSICS, aabb, feetOnPlatform }

let blockRegistry = {}

export function setBlockRegistry(blocks) {
  blockRegistry = {}
  for (const b of blocks || []) {
    blockRegistry[b.kind || b.id] = b
  }
}

export function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    w: PHYSICS.playerW,
    h: PHYSICS.playerH,
    onGround: false,
    onWall: 0,
    coyote: 0,
    jumpBuffer: 0,
    jumpsLeft: 1,
    extraJumps: 0,
    facing: 1,
    squash: 1,
    stretch: 1,
    fallingThrough: false,
    deployed: [],
    onSlippery: null,
    gravityMult: 1,
  }
}

export function stepPhysics(player, input, solids, walls, props, itemState, dt, chunk, time = 0) {
  const p = PHYSICS

  tickItemState(itemState, chunk, blockRegistry)

  player.onSlippery = null
  player.gravityMult = 1
  player.flipFloatActive = false

  updateMovingPlatforms(solids, dt, blockRegistry, itemState)

  if (player.fallingThrough) {
    player.vy += p.gravity * dt
    player.vy = Math.min(player.vy, p.maxFall * 1.5)
    player.x += player.vx * dt
    player.y += player.vy * dt
    return { wallJump: false, landed: false, bounced: false, lethal: false }
  }

  if (input.left()) {
    player.vx -= p.moveAccel * dt
    player.facing = -1
  }
  if (input.right()) {
    player.vx += p.moveAccel * dt
    player.facing = 1
  }

  if (!input.left() && !input.right()) {
    let friction = player.onGround ? p.groundFriction : p.airFriction
    if (player.onSlippery != null) friction = player.onSlippery
    player.vx *= Math.pow(friction, dt)
    if (Math.abs(player.vx) < 0.05) player.vx = 0
  }

  player.vx = clamp(player.vx, -p.maxSpeedX, p.maxSpeedX)

  if (player.onGround) {
    player.coyote = p.coyoteFrames
    player.jumpsLeft = 1 + player.extraJumps
  } else if (player.coyote > 0) {
    player.coyote -= dt
  }

  if (input.consumeJump()) {
    player.jumpBuffer = p.jumpBufferFrames
  } else if (player.jumpBuffer > 0) {
    player.jumpBuffer -= dt
  }

  let wallJump = false
  const well = wellInfluence(player, itemState.wells)
  const jumpScale = wellJumpScale(well)

  if (player.jumpBuffer > 0) {
    if (player.onGround || player.coyote > 0) {
      player.vy = p.jumpVel * jumpScale
      player.onGround = false
      player.coyote = 0
      player.jumpBuffer = 0
      player.jumpsLeft = player.extraJumps
      player.squash = 0.7
      player.stretch = 1.3
    } else if (player.jumpsLeft > 0) {
      player.vy = p.jumpVel * 0.95 * jumpScale
      player.jumpsLeft -= 1
      player.jumpBuffer = 0
      player.squash = 0.75
      player.stretch = 1.25
    }
  }

  const gravityScale = wellGravityScale(well)
  const flipFromItem = itemState.flipGravityUntil && Date.now() < itemState.flipGravityUntil
  const flipFromZone = detectFlipZone(player, solids, blockRegistry)
  player.flipFloatActive = flipFromItem || flipFromZone

  if (player.flipFloatActive && chunk) {
    applyFlipFloat(player, chunk, dt, p)
  } else {
    player.vy += p.gravity * gravityScale * dt
    player.vy = Math.min(player.vy, p.maxFall)
    applyWellFloat(player, well, dt)
  }

  applyGravityZones(player, solids, dt, blockRegistry)

  player.x += player.vx * dt
  player.y += player.vy * dt

  player.onGround = false
  player.onWall = 0

  let bounced = false
  const landResult = resolveCollisions(player, solids, walls, input, chunk)
  if (landResult?.bounced) bounced = true

  carryPlayerOnMoving(player, solids)

  for (const prop of props) {
    resolveProp(player, prop, solids)
  }

  for (const deployed of player.deployed) {
    if (deployed.kind === "spring_pad") {
      resolveSpringPad(player, deployed)
    }
  }

  let lethal = checkLethalTouch(player, solids, blockRegistry)
  const pendulumHit = !lethal && checkPendulumHit(player, props, time, itemState)

  player.squash += (1 - player.squash) * 0.2 * dt
  player.stretch += (1 - player.stretch) * 0.2 * dt

  return { wallJump, landed: player.onGround, bounced, lethal, pendulumHit }
}

function carryPlayerOnMoving(player, solids) {
  for (const plat of solids) {
    if (plat.removed || !plat._dx) continue
    if (player.onGround && feetOnPlatform(player, plat)) {
      player.x += plat._dx
      player.y += plat._dy || 0
    }
  }
}

function wellInfluence(player, wells) {
  let strength = 0
  let lowMult = 1
  let jumpMult = 0.55
  let maxFall = 0.35

  for (const well of wells || []) {
    const cx = well.x + well.w / 2
    const cy = well.y + well.h / 2
    const px = player.x + player.w / 2
    const py = player.y + player.h / 2
    const dist = Math.hypot(cx - px, cy - py)
    const radius = well.radius ?? 120
    if (dist >= radius) continue

    const s = 1 - dist / radius
    if (s > strength) {
      strength = s
      lowMult = well.lowMult ?? 0.04
      jumpMult = well.jumpMult ?? 0.55
      maxFall = well.maxFall ?? 0.35
    }
  }

  return { strength, lowMult, jumpMult, maxFall, inWell: strength > 0.04 }
}

function wellGravityScale(well) {
  if (!well.inWell) return 1
  return 1 - well.strength * (1 - well.lowMult)
}

function wellJumpScale(well) {
  if (!well.inWell) return 1
  return well.jumpMult + 0.12 * (1 - well.strength)
}

function applyWellFloat(player, well, dt) {
  if (!well.inWell || player.flipFloatActive) return

  const fallCap = well.maxFall * well.strength + 0.55 * (1 - well.strength)
  if (player.vy > fallCap) player.vy = fallCap

  if (player.vy > 0.15) {
    player.vy -= 0.14 * well.strength * dt
  }

  if (Math.abs(player.vy) < 0.55 && well.strength > 0.5) {
    player.vy -= 0.11 * well.strength * dt
  }
}

function detectFlipZone(player, platforms, blockRegistry) {
  for (const plat of platforms) {
    if (plat.removed) continue
    if (!behaviorList(plat, blockRegistry).includes("flip_gravity")) continue

    const p = paramsFor(plat, "flip_gravity")
    const radius = p.radius ?? Math.max(plat.w, plat.h)
    const cx = plat.x + plat.w / 2
    const cy = plat.y + plat.h / 2
    const px = player.x + player.w / 2
    const py = player.y + player.h / 2
    if (Math.hypot(cx - px, cy - py) <= radius) return true
  }

  return false
}

function applyFlipFloat(player, chunk, dt, p) {
  const exitY = chunk.exit_y ?? 60
  const feet = player.y + player.h
  const belowExit = feet - exitY

  player.vy += p.gravity * 0.18 * dt

  if (belowExit > 20) {
    const pull = Math.min(0.16, 0.04 + belowExit / 550)
    player.vy -= pull * dt
  } else if (belowExit < -10) {
    player.vy += 0.05 * dt
  }

  player.vy = clamp(player.vy, -4, 2.6)
}

function resolveCollisions(player, solids, walls, input, chunk) {
  for (const wall of walls) {
    if (!aabb(player, wall)) continue
    if (player.x + player.w / 2 < wall.x + wall.w / 2) {
      player.x = wall.x - player.w
    } else {
      player.x = wall.x + wall.w
    }
    player.vx = 0
  }

  let landResult = null

  for (const plat of solids) {
    if (!aabb(player, plat)) continue

    const feet = player.y + player.h
    const head = player.y

    if (player.vy >= 0 && feet > plat.y && head < plat.y + plat.h) {
      if (skipVerticalLanding(player, plat, input, blockRegistry)) continue

      player.y = plat.y - player.h

      const blockResult = onPlatformLand(player, plat, chunk, blockRegistry)
      if (blockResult?.bounced) {
        landResult = { bounced: true }
      } else {
        player.vy = 0
        player.onGround = true
        if (Math.abs(player.vx) > 1) {
          player.squash = 1.2
          player.stretch = 0.85
        }
      }
    } else if (player.vy < 0 && head < plat.y + plat.h && feet > plat.y) {
      player.y = plat.y + plat.h
      player.vy = 0
    }
  }

  for (const plat of solids) {
    if (!aabb(player, plat)) continue
    const feet = player.y + player.h
    if (Math.abs(feet - plat.y) < 2) continue

    const overlapLeft = player.x + player.w - plat.x
    const overlapRight = plat.x + plat.w - player.x

    if (overlapLeft < overlapRight) {
      player.x = plat.x - player.w
      player.vx = 0
    } else {
      player.x = plat.x + plat.w
      player.vx = 0
    }
  }

  return landResult
}

function resolveProp(player, prop, solids) {
  if (prop.kind === "crate") {
    if (aabb(player, prop)) {
      const push = player.vx * 0.35
      prop.vx = (prop.vx || 0) + push
      resolveCratePhysics(prop, player)
    }
  } else if (prop.kind === "spring") {
    if (aabb(player, prop)) {
      onPropTouch(player, prop, blockRegistry)
    }
  }
}

function resolveCratePhysics(crate, player) {
  if (!aabb(player, crate)) return
  const overlapTop = player.y + player.h - crate.y
  if (overlapTop < 14 && player.vy >= 0) {
    player.y = crate.y - player.h
    player.vy = 0
    player.onGround = true
    player.x += crate.vx || 0
  }
}

function resolveSpringPad(player, pad) {
  if (aabb(player, pad)) {
    player.vy = PHYSICS.jumpVel * 1.4
    player.onGround = false
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export function stepCrateInteractions(player, props) {
  for (const prop of props) {
    if (prop.kind === "crate") {
      resolveCratePhysics(prop, player)
    }
  }
}

export function useItem(player, itemState, chunk) {
  return useItemBehavior(itemState.current, player, itemState, chunk, blockRegistry)
}

export function applyPassiveItem(player, item) {
  applyPassiveBehaviors(player, item)
}

export function activeSolids(platforms) {
  return (platforms || []).filter((p) => p.kind !== "wall" && !p.removed)
}
