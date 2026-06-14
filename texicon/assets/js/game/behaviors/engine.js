import { behaviors as BEHAVIOR_PRESETS } from "../../lol/behaviors.js"
import { physics as PHYSICS } from "../../lol/config.js"
import { aabb } from "../physics_collision.js"
import { pendulumBob, pendulumFrozen, playerOnPendulumTop } from "../pendulum.js"

export function paramsFor(entity, behaviorId) {
  const key = behaviorId === "freeze_camera" ? "freeze" : behaviorId
  const preset = BEHAVIOR_PRESETS[key]?.params || {}
  const overrides = entity?.behaviorParams?.[behaviorId] || entity?.behaviorParams?.[key] || {}
  return { ...preset, ...overrides }
}

export function behaviorList(entity, blockRegistry = {}) {
  if (entity?.behaviors?.length) return entity.behaviors
  const reg = blockRegistry[entity?.kind]
  if (reg?.behaviors?.length) return reg.behaviors
  if (entity?.kind === "bouncy") return ["bounce"]
  if (entity?.kind === "oneway") return ["oneway"]
  if (entity?.kind === "button_spring") return ["button_spring"]
  if (entity?.kind === "spring") return ["spring"]
  if (entity?.kind === "crate") return ["crate"]
  if (entity?.kind === "crumble") return ["fragile"]
  if (entity?.kind === "ice") return ["slippery"]
  if (entity?.kind === "mover") return ["moving"]
  if (entity?.kind === "spike") return ["lethal"]
  if (entity?.kind === "upgrav_tile") return ["gravity_zone"]
  if (entity?.kind === "flip_tile") return ["flip_gravity"]
  return []
}

export function skipVerticalLanding(player, plat, input, blockRegistry) {
  const list = behaviorList(plat, blockRegistry)
  if (list.includes("oneway") && input.down && player.y + player.h <= plat.y + plat.h + 4) {
    return true
  }
  return false
}

export function onPlatformLand(player, plat, chunk, blockRegistry, ctx = {}) {
  const list = behaviorList(plat, blockRegistry)
  let result = null

  for (const id of list) {
    const p = paramsFor(plat, id)
    switch (id) {
      case "bounce": {
        const mult = p.mult ?? PHYSICS.bouncyMult
        const vy = p.vy ?? PHYSICS.jumpVel
        player.vy = vy * mult
        player.onGround = false
        result = { bounced: true }
        break
      }
      case "fragile": {
        if (plat.hits == null) plat.hits = p.hits ?? 1
        plat.hits -= 1
        plat._cracked = true
        if (plat.hits <= 0) {
          plat.removed = true
          ctx.renderer?.addParticles?.(ctx.screenX, ctx.screenY, 12, "#cdb4db")
        }
        break
      }
      case "button_spring": {
        if (plat.triggered) break
        plat.triggered = true
        chunk.props = chunk.props || []
        chunk.props.push({
          id: `btn-spring-${plat.id || Date.now()}`,
          kind: "spring",
          x: plat.x + plat.w / 2 - 14,
          y: plat.y - 32,
          w: 28,
          h: 28,
        })
        const mult = p.mult ?? 1.2
        const vy = p.vy ?? PHYSICS.jumpVel
        player.vy = vy * mult
        player.onGround = false
        result = { bounced: true }
        break
      }
      case "slippery":
        player.onSlippery = p.friction ?? 0.12
        break
      default:
        break
    }
  }

  return result
}

export function onPropTouch(player, prop, blockRegistry) {
  const list = behaviorList(prop, blockRegistry)
  for (const id of list) {
    const p = paramsFor(prop, id)
    if (id === "spring") {
      const mult = p.mult ?? 1.5
      const vy = p.vy ?? PHYSICS.jumpVel
      player.vy = vy * mult
      player.onGround = false
      return true
    }
    if (id === "lethal") {
      return { lethal: true }
    }
  }
  return false
}

export function updateMovingPlatforms(platforms, dt, blockRegistry, itemState = {}) {
  const globallyFrozen = itemState.frozenUntil && Date.now() < itemState.frozenUntil

  for (const plat of platforms) {
    if (plat.removed) continue
    const list = behaviorList(plat, blockRegistry)
    if (!list.includes("moving") || plat._pinned || globallyFrozen) {
      plat._dx = 0
      plat._dy = 0
      continue
    }

    const p = paramsFor(plat, "moving")
    const speed = p.speed ?? 1.2
    const range = p.range ?? 120
    const axis = p.axis ?? "x"

    const prevX = plat.x
    const prevY = plat.y

    plat._movePhase = (plat._movePhase ?? 0) + dt * speed * 0.05
    const offset = Math.sin(plat._movePhase) * range
    if (axis === "y") {
      plat._baseY = plat._baseY ?? plat.y
      plat.y = plat._baseY + offset
    } else {
      plat._baseX = plat._baseX ?? plat.x
      plat.x = plat._baseX + offset
    }

    plat._dx = plat.x - prevX
    plat._dy = plat.y - prevY
  }
}

export function applyGravityZones(player, platforms, dt, blockRegistry) {
  for (const plat of platforms) {
    if (plat.removed) continue
    const list = behaviorList(plat, blockRegistry)
    if (!list.includes("gravity_zone")) continue

    const p = paramsFor(plat, "gravity_zone")
    const radius = p.radius ?? Math.max(plat.w, plat.h)
    const cx = plat.x + plat.w / 2
    const cy = plat.y + plat.h / 2
    const px = player.x + player.w / 2
    const py = player.y + player.h / 2
    const dist = Math.hypot(cx - px, cy - py)

    if (dist > radius) continue

    const gz = paramsFor(plat, "gravity_zone")
    const strength = 1 - dist / (radius || 1)
    player.vy += (gz.gravity ?? -0.85) * strength * dt
    const dx = cx - px
    player.vx += (dx / (Math.abs(dx) || 1)) * (gz.pull_x ?? 0.15) * strength * dt
  }
}

export function checkLethalTouch(player, platforms, blockRegistry) {
  for (const plat of platforms) {
    if (plat.removed) continue
    if (!behaviorList(plat, blockRegistry).includes("lethal")) continue
    if (aabb(player, plat)) return true
  }
  return false
}

export function checkPendulumHit(player, props, time = 0, itemState = {}) {
  for (const prop of props || []) {
    if (prop.kind !== "pendulum" || prop.detonated) continue
    if (pendulumFrozen(prop, itemState)) continue

    const { cx, cy, r } = pendulumBob(prop, time, itemState)
    if (playerOnPendulumTop(player, prop, time, itemState)) continue

    const px = player.x + player.w / 2
    const py = player.y + player.h / 2
    const dist = Math.hypot(cx - px, cy - py)
    if (dist < r + 6) return true
  }

  return false
}

export function tickItemState(itemState, chunk, blockRegistry) {
  const now = Date.now()

  if (itemState.frozenUntil && now >= itemState.frozenUntil) {
    itemState.frozenUntil = 0
    for (const prop of chunk?.props || []) {
      if (prop.kind === "pendulum") prop.frozen = false
    }
    for (const plat of chunk?.platforms || []) {
      if (plat._frozenByCamera) {
        plat._frozenByCamera = false
        if (!itemState.pinUntil || now >= itemState.pinUntil) plat._pinned = false
      }
    }
  }

  if (itemState.pinUntil && now >= itemState.pinUntil) {
    itemState.pinUntil = 0
    for (const plat of chunk?.platforms || []) {
      if (plat._pinned) plat._pinned = false
    }
  }
}

export function useItemBehavior(item, player, itemState, chunk, blockRegistry) {
  if (!item) return false
  if (!item.passive && (itemState.uses ?? 0) <= 0) return false

  const effect = item?.effect || item?.id
  const list = item?.behaviors?.length ? item.behaviors : [effect]

  for (const id of list) {
    const p = paramsFor(item, id)
    switch (id) {
      case "extra_jump":
        player.extraJumps = p.count ?? 1
        return false
      case "gravity_well": {
        const radius = p.radius ?? 120
        itemState.wells.push({
          x: player.x + player.w / 2 - radius,
          y: player.y + player.h / 2 - radius,
          w: radius * 2,
          h: radius * 2,
          radius,
          lowMult: p.low_mult ?? p.lowMult ?? 0.04,
          jumpMult: p.jump_mult ?? p.jumpMult ?? 0.55,
          maxFall: p.max_fall ?? p.maxFall ?? 0.35,
        })
        itemState.uses -= 1
        return true
      }
      case "freeze":
      case "freeze_camera": {
        const duration = p.duration ?? 4000
        itemState.frozenUntil = Date.now() + duration
        for (const prop of chunk.props || []) {
          if (prop.kind === "pendulum") prop.frozen = true
        }
        for (const plat of chunk.platforms || []) {
          if (behaviorList(plat, blockRegistry).includes("moving")) {
            plat._pinned = true
            plat._frozenByCamera = true
          }
        }
        itemState.uses -= 1
        return true
      }
      case "flip_gravity":
        itemState.flipGravityUntil = Date.now() + (p.duration ?? 3500)
        itemState.uses -= 1
        return true
      case "dash":
        player.vx = PHYSICS.maxSpeedX * 2.2 * player.facing
        itemState.uses -= 1
        return true
      case "deploy_spring":
        return useDeploySpring(player, itemState, chunk)
      case "bomb_platform":
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
      case "push_block":
        return usePushBlock(player, itemState, chunk)
      case "box_gun":
        return useBoxGun(player, itemState, chunk)
      case "grapple_line":
        player.vy = PHYSICS.jumpVel * 0.85
        player.vx = player.facing * PHYSICS.maxSpeedX * 1.5
        itemState.uses -= 1
        return true
      case "pin_platform":
        return usePinPlatform(player, itemState, chunk, blockRegistry, p)
      default:
        break
    }
  }

  return false
}

function usePinPlatform(player, itemState, chunk, blockRegistry, params) {
  const range = params.range ?? 180
  const duration = params.duration ?? 4000
  const px = player.x + player.w / 2
  const py = player.y + player.h / 2

  let nearest = null
  let bestDist = range

  for (const plat of chunk.platforms || []) {
    if (plat.removed || !behaviorList(plat, blockRegistry).includes("moving")) continue
    const cx = plat.x + plat.w / 2
    const cy = plat.y + plat.h / 2
    const d = Math.hypot(cx - px, cy - py)
    if (d < bestDist) {
      bestDist = d
      nearest = plat
    }
  }

  if (!nearest) return false

  nearest._movePhase = nearest._movePhase ?? 0
  nearest._pinned = true
  itemState.pinUntil = Date.now() + duration
  itemState.uses -= 1
  return true
}

function chunkSolids(chunk) {
  return (chunk.platforms || []).filter((p) => p.kind !== "wall" && !p.removed)
}

function useDeploySpring(player, itemState, chunk) {
  if (!player.onGround) return false

  const solids = chunkSolids(chunk)
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
  const padX = clamp(
    player.x + player.facing * 20,
    standPlat.x + 4,
    standPlat.x + standPlat.w - padW - 4
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

export function findAimTarget(player, solids, range = 150) {
  const dir = player.facing || 1
  const startX = player.x + player.w / 2
  const feetY = player.y + player.h
  let best = null
  let bestDist = Infinity

  for (let step = 20; step <= range; step += 10) {
    const probeX = startX + dir * step

    for (const plat of solids) {
      if (plat.kind === "spawn" || plat.id === "spawn") continue
      if (probeX < plat.x || probeX > plat.x + plat.w) continue

      const top = plat.y
      if (top > feetY + 6) continue
      if (top < feetY - 150) continue

      const placeX = clamp(probeX - 14, plat.x + 4, plat.x + plat.w - 32)
      const score = step + Math.abs(top - feetY) * 0.25
      if (score < bestDist) {
        bestDist = score
        best = { plat, placeX, placeY: top }
      }
    }
  }

  return best
}

function findStandPlatform(player, solids) {
  const dir = player.facing || 1
  const probeX = player.x + player.w / 2 + dir * 28
  const feetY = player.y + player.h

  for (const plat of solids) {
    if (plat.kind === "spawn") continue
    if (probeX < plat.x || probeX > plat.x + plat.w) continue
    if (Math.abs(feetY - plat.y) > 10) continue
    return {
      plat,
      placeX: clamp(probeX - 14, plat.x + 4, plat.x + plat.w - 32),
      placeY: plat.y,
    }
  }
  return null
}

function findCrateStackY(chunk, x, w = 28) {
  let top = null

  for (const crate of chunk.props || []) {
    if (crate.kind !== "crate" || crate.detonated) continue
    const overlapX = x + w > crate.x + 2 && x < crate.x + crate.w - 2
    if (!overlapX) continue
    if (!top || crate.y < top.y) top = crate
  }

  return top ? top.y - 28 : null
}

function spawnCrate(chunk, x, y) {
  chunk.props = chunk.props || []
  chunk.props.push({
    id: `crate-${Date.now()}`,
    kind: "crate",
    x,
    y,
    w: 28,
    h: 28,
    vx: 0,
    vy: 0,
  })
}

function usePushBlock(player, itemState, chunk) {
  const solids = chunkSolids(chunk)
  const aim = findAimTarget(player, solids, 140) || findStandPlatform(player, solids)

  if (aim) {
    const stackY = findCrateStackY(chunk, aim.placeX)
    spawnCrate(chunk, aim.placeX, stackY ?? aim.placeY - 28)
  } else {
    const dir = player.facing || 1
    const crateY = findCrateStackY(chunk, player.x + dir * 36) ?? player.y - 4
    spawnCrate(chunk, player.x + dir * 36, crateY)
  }

  itemState.uses -= 1
  return true
}

function useBoxGun(player, itemState, chunk) {
  const solids = chunkSolids(chunk)
  const aim = findAimTarget(player, solids, 160)
  if (!aim?.plat) return false

  const kind = aim.plat.kind
  if (kind === "spawn" || kind === "exit" || aim.plat.id === "spawn") return false

  aim.plat.removed = true
  spawnCrate(chunk, aim.placeX, aim.placeY - 28)
  itemState.uses -= 1
  return true
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export function applyPassiveBehaviors(player, item) {
  if (!item) return
  const list = item.behaviors?.length ? item.behaviors : []
  const effect = item.effect || item.id

  if (item.passive || list.includes("extra_jump") || effect === "extra_jump" || item.id === "double_jump") {
    const p = paramsFor(item, "extra_jump")
    player.extraJumps = p.count ?? 1
  }
}

export function drawBehaviorOverlay(ctx, plat, x, y, w, h, scale, blockRegistry) {
  const list = behaviorList(plat, blockRegistry)
  if (list.includes("bounce") || plat.kind === "bouncy") {
    ctx.fillStyle = "rgba(255,255,255,0.25)"
    ctx.fillRect(x + 4 * scale, y + 2 * scale, w - 8 * scale, 3 * scale)
  }
  if (list.includes("button_spring") || plat.kind === "button_spring") {
    ctx.fillStyle = "#ef476f"
    ctx.fillRect(x + w * 0.3, y + h * 0.35, w * 0.4, h * 0.3)
  }
  if (list.includes("fragile") || plat.kind === "crumble" || plat._cracked) {
    ctx.strokeStyle = "rgba(0,0,0,0.25)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + w * 0.2, y + h * 0.3)
    ctx.lineTo(x + w * 0.5, y + h * 0.7)
    ctx.lineTo(x + w * 0.8, y + h * 0.2)
    ctx.stroke()
  }
  if (list.includes("slippery") || plat.kind === "ice") {
    ctx.fillStyle = "rgba(255,255,255,0.35)"
    ctx.fillRect(x + 2 * scale, y + 1 * scale, w - 4 * scale, h - 2 * scale)
  }
  if (list.includes("moving") || plat.kind === "mover") {
    ctx.fillStyle = "rgba(255,255,255,0.2)"
    ctx.fillRect(x + w * 0.1, y + h * 0.4, w * 0.8, h * 0.2)
  }
  if (plat._pinned) {
    ctx.strokeStyle = "#ffd166"
    ctx.lineWidth = 2 * scale
    ctx.strokeRect(x + 2 * scale, y + 2 * scale, w - 4 * scale, h - 4 * scale)
  }
  if (list.includes("lethal") || plat.kind === "spike") {
    ctx.fillStyle = "#ef476f"
    for (let i = 0; i < w; i += 8 * scale) {
      ctx.beginPath()
      ctx.moveTo(x + i, y + h)
      ctx.lineTo(x + i + 4 * scale, y)
      ctx.lineTo(x + i + 8 * scale, y + h)
      ctx.fill()
    }
  }
}

export { BEHAVIOR_PRESETS }
