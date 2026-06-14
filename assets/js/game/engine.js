import { createInput, InputBuffer } from "./input.js"
import { stepCrates } from "./crate_physics.js"
import {
  createPlayer,
  stepPhysics,
  useItem,
  applyPassiveItem,
  activeSolids,
  setBlockRegistry,
  stepCrateInteractions,
} from "./physics.js"
import { collectPendulumSolids, carryPlayerOnPendulums } from "./pendulum.js"
import { Renderer } from "./renderer.js"
import { GameAudio } from "./audio.js"
import { createGameDebug } from "./debug.js"
import { game, hud, physics as PHYSICS } from "../lol/config.js"
import { normalizeChunk, num } from "./chunk_utils.js"

const CHUNK_HEIGHT = game.chunkHeight
const WORLD_WIDTH = game.worldWidth
const DEATH_FALL = CHUNK_HEIGHT * game.deathFallChunks
const START_Y = CHUNK_HEIGHT - 80
const ADVANCE_COOLDOWN_MS = 500

export class GameEngine {
  constructor(canvas, hook) {
    this.canvas = canvas
    this.hook = hook
    this.renderer = new Renderer(canvas)
    this.input = createInput()
    this.inputBuffer = new InputBuffer(this.input)
    this.audio = new GameAudio()
    this.debug = createGameDebug(this)

    this.chunks = new Map()
    this.seed = 0
    this.running = false
    this.paused = true
    this.debugMode = false

    this.player = createPlayer(WORLD_WIDTH / 2 - 12, START_Y)
    this.cameraY = 0
    this.currentChunk = 0
    this.startWorldY = START_Y
    this.maxDistance = 0
    this.distanceSentAt = 0

    this.loadout = []
    this.activeSlot = 0
    this.itemState = {
      current: null,
      uses: 0,
      wells: [],
      frozenUntil: 0,
      flipGravityUntil: 0,
      pinUntil: 0,
    }

    this.fallDeathTimer = 0
    this.lastChunkRequest = -1
    this.pendingAdvance = null
    this.requestedChunks = new Set()
    this.advanceCooldownUntil = 0
    this.blockColors = {}
    this.blockRegistry = {}
    this.highScore = 0
    this.deathSent = false
    this.hazardRespawnUntil = 0
    this.allItems = []

    this.loop = this.loop.bind(this)
    this.raf = null
    this.lastFrameTime = null
  }

  viewHeightWorld() {
    const scale = this.renderer.width / WORLD_WIDTH
    return this.renderer.height / scale
  }

  updateCamera() {
    this.cameraY = this.worldY() - this.viewHeightWorld() * 0.68
  }

  chunkFloorY(chunk) {
    const spawn = (chunk.platforms || []).find((p) => p.id === "spawn")
    if (spawn) return spawn.y
    return chunk.entry_y ?? CHUNK_HEIGHT - 48
  }

  exitY(chunk) {
    return chunk?.exit_y ?? 60
  }

  spawnY(chunk) {
    if (!chunk) return START_Y
    return this.chunkFloorY(chunk) - PHYSICS.playerH
  }

  respawnFromHazard(chunk) {
    if (Date.now() < this.hazardRespawnUntil) return
    this.hazardRespawnUntil = Date.now() + 700

    this.snapToSpawn(chunk)
    this.player.vy = 0
    this.player.vx = 0
    this.player.fallingThrough = false
    this.fallDeathTimer = 0
    this.deathSent = false
    this.renderer.setFade(0)
    this.renderer.shakeScreen(8)

    const screen = this.renderer.toScreen(
      this.player.x,
      this.worldY(),
      this.cameraY,
      WORLD_WIDTH
    )
    this.renderer.addParticles(screen.x, screen.y, 14, "#f72585")
  }

  snapToSpawn(chunk) {
    if (!chunk) return
    const solids = activeSolids(chunk.platforms)
    const spawn = solids.find((p) => p.id === "spawn")
    if (spawn) {
      this.player.x = clamp(
        this.player.x,
        spawn.x + 8,
        spawn.x + spawn.w - this.player.w - 8
      )
      this.player.y = spawn.y - this.player.h
    } else {
      this.player.y = this.spawnY(chunk)
    }
    this.player.vy = 0
    this.player.onGround = true
  }

  resize() {
    const stage =
      this.canvas.closest(".game-stage") ||
      document.getElementById("game-root")
    const w = stage?.clientWidth || window.innerWidth
    const h = stage?.clientHeight || window.innerHeight
    this.renderer.resize(w, h)
    if (this.player && !this.paused) this.updateCamera()
  }

  worldY() {
    return this.currentChunk * CHUNK_HEIGHT + this.player.y
  }

  init({ seed, chunks, high_score, loadout, items, block_colors, blocks, debug }) {
    this.seed = seed
    this.debugMode = !!debug
    this.allItems = items || []
    this.chunks.clear()
    this.requestedChunks = new Set()
    chunks.forEach((c) => this.chunks.set(num(c.index), normalizeChunk(c)))
    this.highScore = high_score?.best_distance || 0
    this.blockColors = block_colors || {}
    this.blockRegistry = {}
    for (const b of blocks || []) {
      this.blockRegistry[b.kind || b.id] = b
    }
    setBlockRegistry(blocks || [])
    this.loadout = (loadout || []).map(normalizeLoadoutItem)
    this.activeSlot = 0
    this.syncActiveItem()
    this.debug.init(debug, items)
    this.resetPlayer()
    this.updateHud()
  }

  normalizeLoadoutItem(item) {
    return normalizeLoadoutItem(item)
  }

  syncActiveItem() {
    const item = this.loadout[this.activeSlot]
    this.itemState.current = item || null
    this.itemState.uses = item?.uses ?? 0
  }

  persistActiveSlotUses() {
    const item = this.loadout[this.activeSlot]
    if (item && !item.passive) {
      item.uses = this.itemState.uses
    }
  }

  selectSlot(index) {
    if (index < 0 || index >= this.loadout.length) return
    this.persistActiveSlotUses()
    this.activeSlot = index
    this.syncActiveItem()
    this.updateHudInventory()
  }

  alignSpawnPlatform(chunk, centerX) {
    if (!chunk) return
    const spawnW = 240
    const spawnH = 16
    const entryY = chunk.entry_y ?? CHUNK_HEIGHT - 48
    const spawnX = clamp(
      Math.round(centerX - spawnW / 2),
      16,
      WORLD_WIDTH - spawnW - 16
    )

    chunk.platforms = chunk.platforms || []
    let spawn = chunk.platforms.find((p) => p.id === "spawn")
    if (spawn) {
      spawn.x = spawnX
      spawn.y = entryY
      spawn.w = spawnW
      spawn.h = spawnH
    } else {
      spawn = {
        id: "spawn",
        x: spawnX,
        y: entryY,
        w: spawnW,
        h: spawnH,
        kind: "spawn",
      }
      chunk.platforms.unshift(spawn)
    }

    this.player.x = clamp(
      centerX - this.player.w / 2,
      spawnX + 8,
      spawnX + spawnW - this.player.w - 8
    )
  }

  resetPlayer() {
    const chunk0 = this.chunks.get(0)
    this.player = createPlayer(WORLD_WIDTH / 2 - 12, this.spawnY(chunk0))
    this.snapToSpawn(chunk0)
    this.currentChunk = 0
    this.startWorldY = this.worldY()
    this.updateCamera()
    this.maxDistance = 0
    this.fallDeathTimer = 0
    this.deathSent = false
    this.player.fallingThrough = false
    this.player.deployed = []
    this.itemState.wells = []
    this.itemState.frozenUntil = 0
    this.itemState.flipGravityUntil = 0
    this.itemState.pinUntil = 0
    this.lastChunkRequest = -1
    this.pendingAdvance = null
    this.requestedChunks = new Set()
    this.advanceCooldownUntil = 0
    for (const item of this.loadout) {
      if (item && !item.passive) item.uses = item.maxUses
    }
    this.syncActiveItem()
    this.applyLoadoutPassives()
    this.renderer.fade = 0

    const chunk = this.chunks.get(0)
    if (chunk?.bg) this.renderer.setBackground(chunk.bg)
    if (chunk?.music) this.audio.setPatterns(chunk.music)
    this.audio.setIntensity(0)
  }

  applyLoadoutPassives() {
    for (const item of this.loadout) {
      applyPassiveItem(this.player, item)
    }
    this.syncActiveItem()
    this.updateHudInventory()
  }

  grantItem(item) {
    if (!item) return
    const normalized = normalizeLoadoutItem(item)
    if (this.loadout.length < 3) {
      this.loadout.push(normalized)
    } else {
      this.loadout[this.activeSlot] = normalized
    }
    this.syncActiveItem()
    applyPassiveItem(this.player, normalized)
    this.updateHudInventory()
  }

  refillLoadout() {
    for (const item of this.loadout) {
      if (item && !item.passive) item.uses = item.maxUses ?? item.uses
    }
    this.syncActiveItem()
    this.updateHudInventory()
  }

  spawnDebugProp(kind) {
    const chunk = this.chunks.get(this.currentChunk)
    if (!chunk) return
    chunk.props = chunk.props || []
    const id = `debug-${Date.now()}`
    if (kind === "bomb") {
      chunk.props.push({
        id,
        kind: "bomb",
        x: this.player.x + 20,
        y: this.player.y,
        w: 20,
        h: 20,
        fuse: 90,
      })
    } else if (kind === "spring") {
      chunk.props.push({
        id,
        kind: "spring",
        x: this.player.x,
        y: this.player.y + this.player.h - 8,
        w: 28,
        h: 28,
      })
    } else if (kind === "crate") {
      chunk.props.push({
        id,
        kind: "crate",
        x: this.player.x + 30,
        y: this.player.y,
        w: 28,
        h: 28,
        vx: 0,
        vy: 0,
      })
    }
  }

  start() {
    this.paused = false
    this.running = true
    this.resize()
    this.ensureLoop()
    try {
      this.audio.start()
    } catch (_) {}
    this.requestChunksAhead()
    this.render()
  }

  requestChunk(index) {
    if (this.chunks.has(index) || this.requestedChunks.has(index)) return
    this.requestedChunks.add(index)
    this.hook.pushEvent("request_chunk", { index })
  }

  requestChunksAhead() {
    if (this.currentChunk > this.lastChunkRequest) {
      this.lastChunkRequest = this.currentChunk
      this.requestChunk(this.currentChunk + game.bufferAhead)
    }
  }

  ensureLoop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(this.loop)
  }

  stop() {
    this.paused = true
    this.running = false
  }

  addChunk(chunk) {
    const index = num(chunk.index)
    if (this.chunks.has(index)) return
    this.chunks.set(index, normalizeChunk(chunk))
    this.requestedChunks.delete(index)
    if (this.pendingAdvance === index) {
      this.tryAdvanceChunk()
    }
  }

  onChunkEnter(chunk = null) {
    const activeChunk = chunk || this.chunks.get(this.currentChunk)
    this.persistActiveSlotUses()
    this.player.deployed = []
    this.player.extraJumps = 0
    this.itemState.frozenUntil = 0
    this.itemState.flipGravityUntil = 0
    this.itemState.pinUntil = 0
    this.player.gravityMult = 1

    if (activeChunk?.loadout_roll?.length) {
      this.applyLoadoutRoll(activeChunk.loadout_roll)
    } else {
      for (const item of this.loadout) {
        applyPassiveItem(this.player, item)
      }
      this.syncActiveItem()
    }

    this.updateHudInventory()
  }

  applyLoadoutRoll(roll) {
    this.loadout = roll.map(normalizeLoadoutItem)
    this.activeSlot = 0
    this.syncActiveItem()
    this.applyLoadoutPassives()
    this.updateHudInventory()

    const screen = this.renderer.toScreen(
      this.player.x,
      this.worldY(),
      this.cameraY,
      WORLD_WIDTH
    )
    this.renderer.addParticles(screen.x, screen.y, 20, "#06d6a0")
  }

  triggerDeath() {
    if (this.deathSent || this.debugMode) return

    this.deathSent = true
    this.itemState.flipGravityUntil = 0
    this.player.gravityMult = 1
    const distance = Math.trunc(this.maxDistance / 10)

    this.hook.pushEvent("player_died", { distance })
    if (typeof this.hook.presentDeath === "function") {
      this.hook.presentDeath(distance)
    }
    this.stop()
  }

  chunkBodies(chunk, fallingThrough) {
    if (!chunk || fallingThrough) {
      return { solids: [], walls: [], props: [] }
    }

    const props = (chunk.props || []).filter((p) => !p.detonated)
    const pendulumSolids = collectPendulumSolids(props, this.renderer.time, this.itemState)
    const solids = [...activeSolids(chunk.platforms), ...pendulumSolids]
    const wallPlats = (chunk.platforms || []).filter((p) => p.kind === "wall" && !p.removed)
    const walls = [...(chunk.walls || []), ...wallPlats]

    return { solids, walls, props }
  }

  updateProps(chunk, dt) {
    if (!chunk?.props) return

    for (const prop of chunk.props) {
      if (prop.kind === "bomb" && !prop.detonated) {
        prop.fuse = (prop.fuse || 60) - dt
        if (prop.fuse <= 0) {
          prop.detonated = true
          chunk.platforms.push({
            id: `bridge-${prop.id}`,
            x: prop.x - 40,
            y: prop.y - 8,
            w: 100,
            h: 14,
            kind: "solid",
          })
          this.renderer.shakeScreen(6)
        }
      }
    }
  }

  crossedExitLine(chunk) {
    const line = this.exitY(chunk)
    const feet = this.player.y + this.player.h
    const flipActive =
      this.itemState.flipGravityUntil && Date.now() < this.itemState.flipGravityUntil

    if (flipActive) {
      return (
        feet <= line + 2 &&
        feet >= line - 6 &&
        Math.abs(this.player.vy) < 2.6 &&
        Math.abs(this.player.vx) < 4.5
      )
    }

    return feet <= line + 4 && this.player.vy <= 0
  }

  tryAdvanceChunk() {
    if (Date.now() < this.advanceCooldownUntil) return false

    const chunk = this.chunks.get(this.currentChunk)
    if (!chunk || this.player.fallingThrough) return false
    if (!this.crossedExitLine(chunk)) return false

    const nextIndex = this.currentChunk + 1
    const nextChunk = this.chunks.get(nextIndex)
    if (!nextChunk) {
      this.pendingAdvance = nextIndex
      this.requestChunk(nextIndex)
      return false
    }

    this.pendingAdvance = null
    const exitCenterX = this.player.x + this.player.w / 2
    this.currentChunk = nextIndex
    this.alignSpawnPlatform(nextChunk, exitCenterX)
    this.snapToSpawn(nextChunk)
    this.advanceCooldownUntil = Date.now() + ADVANCE_COOLDOWN_MS
    this.onChunkEnter(nextChunk)

    this.renderer.flashExitLine = 12
    const screen = this.renderer.toScreen(
      this.player.x,
      this.worldY(),
      this.cameraY,
      WORLD_WIDTH
    )
    this.renderer.addParticles(screen.x, screen.y + 20, 20, "#ffd166")

    this.renderer.beginBgTransition(chunk.bg, nextChunk.bg)
    if (nextChunk.music) this.audio.transitionTo(nextChunk.music, this.currentChunk)
    else this.audio.setIntensity(this.currentChunk)

    this.requestChunksAhead()

    return true
  }

  loop(timestamp) {
    this.raf = requestAnimationFrame(this.loop)
    if (this.paused) {
      this.lastFrameTime = null
      return
    }

    if (this.lastFrameTime == null) this.lastFrameTime = timestamp
    const dt = Math.min((timestamp - this.lastFrameTime) / (1000 / 60), 2.5)
    this.lastFrameTime = timestamp

    this.inputBuffer.update()
    this.debug.onKey(this.inputBuffer)
    this.handleSlotInput()
    this.update(dt)
    this.render(dt)
    this.audio.update(dt)
  }

  handleSlotInput() {
    const slot = this.inputBuffer.consumeSlot()
    if (slot != null) this.selectSlot(slot)
  }

  update(dt) {
    if (this.deathSent) return

    const chunk = this.chunks.get(this.currentChunk)
    if (!chunk) return

    this.updateProps(chunk, dt)

    if (this.inputBuffer.consumeItem()) {
      this.syncActiveItem()
      const used = useItem(this.player, this.itemState, chunk)
      this.persistActiveSlotUses()
      if (used) {
        const screen = this.renderer.toScreen(
          this.player.x,
          this.worldY(),
          this.cameraY,
          WORLD_WIDTH
        )
        this.renderer.addParticles(screen.x, screen.y, 12, "#ffd166")
        this.updateHudInventory()
      }
    }

    const { solids, walls, props } = this.chunkBodies(chunk, this.player.fallingThrough)

    if (!this.player.fallingThrough) {
      stepCrates(props, solids, walls, dt)
    }

    const steps = 3
    const subDt = dt / steps
    let result = { wallJump: false, landed: false, bounced: false, lethal: false }
    for (let i = 0; i < steps; i++) {
      result = stepPhysics(
        this.player,
        this.inputBuffer,
        solids,
        walls,
        props,
        this.itemState,
        subDt,
        chunk,
        this.renderer.time
      )
    }

    stepCrateInteractions(this.player, props)
    carryPlayerOnPendulums(this.player, props)

    if (result.pendulumHit && !this.debugMode) {
      this.triggerDeath()
      return
    }

    if (result.lethal && !this.debugMode) {
      this.triggerDeath()
      return
    }

    if (result.wallJump) {
      const screen = this.renderer.toScreen(
        this.player.x,
        this.worldY(),
        this.cameraY,
        WORLD_WIDTH
      )
      this.renderer.addParticles(screen.x, screen.y, 8, "#adb5bd")
    }

    if (result.bounced) {
      this.renderer.shakeScreen(3)
    }

    if (result.landed && Math.abs(this.player.vy) > 8) {
      this.renderer.shakeScreen(4)
    }

    this.tryAdvanceChunk()
    this.updateCamera()
    this.maxDistance = Math.max(this.maxDistance, Math.max(0, this.startWorldY - this.worldY()))

    this.checkDeath(dt)

    if (!this.debugMode && Date.now() - this.distanceSentAt > 500) {
      this.distanceSentAt = Date.now()
      this.hook.pushEvent("distance_update", { distance: Math.trunc(this.maxDistance / 10) })
      this.updateHudDistance()
    }
  }

  checkDeath(_dt) {
    const chunk = this.chunks.get(this.currentChunk)
    if (!chunk) return

    const floorY = this.chunkFloorY(chunk)
    const feet = this.player.y + PHYSICS.playerH
    const pastFloor = feet > floorY + 32
    const pastChunkBottom = this.player.y > CHUNK_HEIGHT + 16
    const pastChunkTop = this.player.y + PHYSICS.playerH < -24
    const deepFall = this.player.y > floorY + DEATH_FALL

    if (this.debugMode) {
      const fellOut = this.player.y > CHUNK_HEIGHT + 32 || this.player.y < -80
      if (fellOut) {
        this.player.fallingThrough = false
        this.fallDeathTimer = 0
        this.deathSent = false
        this.renderer.setFade(0)
        this.snapToSpawn(chunk)
        this.player.vy = 0
      }
      return
    }

    if (this.deathSent) return

    const flipActive =
      this.itemState.flipGravityUntil && Date.now() < this.itemState.flipGravityUntil

    if (pastChunkBottom || (pastChunkTop && !flipActive) || deepFall) {
      this.triggerDeath()
      return
    }

    if (pastFloor && !this.player.fallingThrough) {
      this.player.fallingThrough = true
      this.player.onGround = false
      this.itemState.flipGravityUntil = 0
      this.player.flipFloatActive = false
      this.fallDeathTimer = 0
      this.renderer.setFade(0.15)
    }

    if (this.player.fallingThrough) {
      this.fallDeathTimer += 1
      this.renderer.setFade(Math.min(1, this.renderer.fade + 0.04))
      if (this.fallDeathTimer > 18) {
        this.triggerDeath()
      }
    }
  }

  render(dt = 1) {
    const flipGravityActive =
      this.itemState.flipGravityUntil && Date.now() < this.itemState.flipGravityUntil

    this.renderer.draw({
      chunks: this.chunks,
      cameraY: this.cameraY,
      chunkHeight: CHUNK_HEIGHT,
      worldWidth: WORLD_WIDTH,
      player: this.player,
      playerWorldY: this.worldY(),
      itemState: this.itemState,
      currentChunk: this.currentChunk,
      blockColors: this.blockColors,
      blockRegistry: this.blockRegistry,
      loadout: this.loadout,
      activeSlot: this.activeSlot,
      flipGravityActive,
      dt,
    })

    if (this.debug.enabled) {
      this.debug.drawOverlay(
        this.renderer.ctx,
        this,
        this.cameraY,
        WORLD_WIDTH,
        CHUNK_HEIGHT
      )
    }
  }

  updateHud() {
    this.updateHudDistance()
    this.updateHudInventory()
    const seedEl = document.getElementById("hud-seed")
    if (seedEl) seedEl.textContent = `${hud.seedLabel} ${this.seed}`
    const bestEl = document.getElementById("hud-best")
    if (bestEl) bestEl.textContent = `${hud.bestLabel} ${this.highScore}${hud.distanceSuffix}`
  }

  updateHudDistance() {
    const el = document.getElementById("hud-distance")
    if (el) el.textContent = `${Math.trunc(this.maxDistance / 10)}${hud.distanceSuffix}`
  }

  updateHudInventory() {
    for (let i = 0; i < 3; i++) {
      const slotEl = document.querySelector(`.inv-slot[data-slot="${i}"]`)
      if (!slotEl) continue
      const item = this.loadout[i]
      slotEl.classList.toggle("active", i === this.activeSlot)
      const nameEl = slotEl.querySelector(".inv-name")
      const usesEl = slotEl.querySelector(".inv-uses")
      const keyEl = slotEl.querySelector(".inv-key")
      if (keyEl) keyEl.textContent = String(i + 1)
      if (!item) {
        if (nameEl) nameEl.textContent = hud.emptySlot
        if (usesEl) usesEl.textContent = ""
      } else {
        if (nameEl) nameEl.textContent = item.name
        if (usesEl) {
          usesEl.textContent = item.passive
            ? "∞"
            : `${item.uses}/${item.maxUses ?? item.uses}`
        }
      }
    }
  }

  destroy() {
    if (this.raf) {
      cancelAnimationFrame(this.raf)
      this.raf = null
    }
    this.input.destroy()
  }
}

function normalizeLoadoutItem(item) {
  if (!item) return null
  const maxUses = num(item.maxUses ?? item.max_uses ?? item.uses, 0)
  const uses = num(item.uses, maxUses)
  return {
    id: item.id,
    name: item.name,
    uses,
    maxUses,
    effect: item.effect,
    description: item.description,
    passive: item.passive === true || item.passive === "true",
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export { CHUNK_HEIGHT, WORLD_WIDTH }
