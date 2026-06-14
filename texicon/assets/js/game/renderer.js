import { drawBehaviorOverlay, findAimTarget } from "./behaviors/engine.js"
import { pendulumSwing } from "./pendulum.js"

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")
    this.particles = []
    this.shake = 0
    this.fade = 0
    this.flashExitLine = 0
    this.time = 0
    this.bgFrom = null
    this.bgTo = null
    this.bgMix = 1
    this.bgTransitionSpeed = 0.025
    this.width = 960
    this.height = 540
  }

  resize(width, height) {
    this.canvas.width = width
    this.canvas.height = height
    this.width = width
    this.height = height
  }

  addParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 20 + Math.random() * 20,
        color,
      })
    }
  }

  shakeScreen(amount) {
    this.shake = Math.max(this.shake, amount)
  }

  setFade(v) {
    this.fade = v
  }

  setBackground(bg) {
    this.bgFrom = null
    this.bgTo = null
    this.bgMix = 1
    this.bgCurrent = bg
  }

  beginBgTransition(fromBg, toBg) {
    if (!fromBg || !toBg) {
      this.setBackground(toBg || fromBg)
      return
    }
    this.bgFrom = fromBg
    this.bgTo = toBg
    this.bgMix = 0
    this.bgCurrent = toBg
  }

  updateBgTransition(dt) {
    if (!this.bgFrom || this.bgMix >= 1) return
    this.bgMix = Math.min(1, this.bgMix + dt * this.bgTransitionSpeed)
    if (this.bgMix >= 1) this.bgFrom = null
  }

  toScreen(worldX, worldY, cameraY, worldWidth) {
    const scale = this.width / worldWidth
    return {
      x: worldX * scale + (this.width - worldWidth * scale) / 2,
      y: (worldY - cameraY) * scale,
      scale,
    }
  }

  viewHeightWorld(worldWidth) {
    const scale = this.width / worldWidth
    return this.height / scale
  }

  visibleChunkIndices(cameraY, chunkHeight, worldWidth) {
    const viewH = this.viewHeightWorld(worldWidth)
    const minIdx = Math.max(0, Math.floor((cameraY - 60) / chunkHeight))
    const maxIdx = Math.ceil((cameraY + viewH + 60) / chunkHeight)
    return { minIdx, maxIdx }
  }

  chunkVisible(idx, chunkHeight, cameraY, worldWidth) {
    const { minIdx, maxIdx } = this.visibleChunkIndices(cameraY, chunkHeight, worldWidth)
    return idx >= minIdx && idx <= maxIdx
  }

  draw(world) {
    const { dt = 1 } = world
    const ctx = this.ctx
    const width = this.width
    const height = this.height
    this.time += dt / 60

    ctx.save()
    if (this.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake
      )
      this.shake *= Math.pow(0.85, dt)
    }

    ctx.clearRect(0, 0, width, height)

    this.drawBackground(world)
    this.drawExitLines(world)
    this.drawPlatforms(world)
    this.drawProps(world)
    this.drawDeployed(world)
    this.drawWells(world)
    this.drawAimGuide(world)
    this.drawPlayer(world)
    this.drawParticles(world.cameraY, world.worldWidth, world.dt)

    ctx.restore()

    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.fade})`
      ctx.fillRect(0, 0, width, height)
    }

    if (world.flipGravityActive) {
      ctx.save()
      ctx.fillStyle = "rgba(188, 108, 37, 0.12)"
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      ctx.font = "12px system-ui, sans-serif"
      ctx.fillText("↕ Low gravity — float toward exit", 12, height - 12)
      ctx.restore()
    }
  }

  drawBackground({ chunks, cameraY, chunkHeight, worldWidth, currentChunk = 0, dt = 1 }) {
    const ctx = this.ctx
    this.updateBgTransition(dt)

    const chunk = chunks.get(currentChunk) || chunks.get(0)
    const bgB = this.bgTo || chunk?.bg
    const bgA = this.bgFrom

    if (bgA && this.bgMix < 1) {
      this.drawBgLayer(bgA, currentChunk, cameraY, chunkHeight, worldWidth, 1 - this.bgMix)
    }
    if (bgB) {
      this.drawBgLayer(bgB, currentChunk, cameraY, chunkHeight, worldWidth, bgA ? this.bgMix : 1)
    }
  }

  drawBgLayer(bg, idx, cameraY, chunkHeight, worldWidth, alpha) {
    const ctx = this.ctx
    if (!bg || alpha <= 0) return

    ctx.save()
    ctx.globalAlpha = alpha

    const grad = ctx.createLinearGradient(0, 0, 0, this.height)
    const colors = bg.colors || []
    colors.forEach((c, i) =>
      grad.addColorStop(i / Math.max(colors.length - 1, 1), c)
    )
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, this.width, this.height)

    for (const shape of bg.shapes || []) {
      const worldX = shape.x * worldWidth + Math.sin(this.time * shape.drift_x + shape.phase) * 20
      const worldY =
        idx * chunkHeight + shape.y * chunkHeight + Math.cos(this.time * shape.drift_y + shape.phase) * 15
      const { x, y, scale } = this.toScreen(worldX, worldY, cameraY, worldWidth)
      const size = shape.size * worldWidth * scale
      ctx.fillStyle = `hsla(${shape.hue}, 60%, 55%, 0.15)`

      ctx.beginPath()
      if (shape.kind === "circle") {
        ctx.arc(x, y, size, 0, Math.PI * 2)
      } else if (shape.kind === "rect") {
        ctx.rect(x - size / 2, y - size / 2, size, size * 0.7)
      } else {
        ctx.moveTo(x, y - size)
        ctx.lineTo(x + size, y + size)
        ctx.lineTo(x - size, y + size)
        ctx.closePath()
      }
      ctx.fill()
    }

    ctx.restore()
  }

  drawExitLines({ chunks, cameraY, chunkHeight, worldWidth, currentChunk = 0, dt = 1 }) {
    const ctx = this.ctx
    if (this.flashExitLine > 0) this.flashExitLine -= dt

    for (const [idx, chunk] of chunks) {
      if (idx > currentChunk) continue
      if (!this.chunkVisible(idx, chunkHeight, cameraY, worldWidth)) continue

      const exitY = chunk.exit_y ?? 60
      const worldY = idx * chunkHeight + exitY
      const { y, scale } = this.toScreen(0, worldY, cameraY, worldWidth)
      const w = this.width

      ctx.save()
      ctx.strokeStyle =
        this.flashExitLine > 0 && idx === currentChunk
          ? "rgba(255,255,255,0.9)"
          : "#ffd166"
      ctx.lineWidth = (this.flashExitLine > 0 && idx === currentChunk ? 4 : 2) * scale
      ctx.setLineDash([12 * scale, 8 * scale])
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }
  }

  drawPlatforms({ chunks, cameraY, chunkHeight, worldWidth, blockColors = {}, blockRegistry = {}, currentChunk = 0, flipGravityActive = false }) {
    const ctx = this.ctx
    const defaultColors = {
      solid: "#6b8cce",
      exit: "#ffd166",
      bouncy: "#06d6a0",
      oneway: "#9b5de5",
      button_spring: "#e07a5f",
      wall: "#3d5a80",
      crumble: "#cdb4db",
      ice: "#a8dadc",
      mover: "#457b9d",
      spike: "#e63946",
      upgrav_tile: "#90be6d",
      flip_tile: "#bc6c25",
    }

    const colors = { ...defaultColors, ...blockColors }

    for (const [idx, chunk] of chunks) {
      if (idx > currentChunk) continue
      if (!this.chunkVisible(idx, chunkHeight, cameraY, worldWidth)) continue

      for (const plat of chunk.platforms) {
        if (plat.removed) continue
        const worldY = idx * chunkHeight + plat.y
        const { x, y, scale } = this.toScreen(plat.x, worldY, cameraY, worldWidth)
        if (y > this.height + 50 || y < -50) continue

        const pw = plat.w * scale
        const ph = plat.h * scale
        ctx.fillStyle = colors[plat.kind] || "#6b8cce"
        roundRect(ctx, x, y, pw, ph, 4 * scale)
        ctx.fill()
        drawBehaviorOverlay(ctx, plat, x, y, pw, ph, scale, blockRegistry)
      }

      for (const wall of chunk.walls || []) {
        const worldY = idx * chunkHeight + wall.y
        const { x, y, scale } = this.toScreen(wall.x, worldY, cameraY, worldWidth)
        ctx.fillStyle = "#3d5a80"
        ctx.fillRect(x, y, wall.w * scale, wall.h * scale)
      }
    }
  }

  drawProps({ chunks, cameraY, chunkHeight, worldWidth, currentChunk = 0, itemState = {}, flipGravityActive = false }) {
    const ctx = this.ctx

    for (const [idx, chunk] of chunks) {
      if (idx > currentChunk) continue
      if (!this.chunkVisible(idx, chunkHeight, cameraY, worldWidth)) continue

      for (const prop of chunk.props || []) {
        if (prop.detonated) continue
        const worldY = idx * chunkHeight + prop.y
        const { x, y, scale } = this.toScreen(prop.x, worldY, cameraY, worldWidth)
        if (y > this.height + 50 || y < -50) continue

        if (prop.kind === "bomb") {
          const pulse = 0.6 + Math.sin(this.time * 8) * 0.4
          ctx.fillStyle = `rgba(255,100,50,${pulse})`
          ctx.beginPath()
          ctx.arc(x + (prop.w * scale) / 2, y + (prop.h * scale) / 2, 10 * scale, 0, Math.PI * 2)
          ctx.fill()
        } else if (prop.kind === "crate") {
          ctx.fillStyle = "#c77d4a"
          roundRect(ctx, x, y, prop.w * scale, prop.h * scale, 3 * scale)
          ctx.fill()
        } else if (prop.kind === "spring") {
          ctx.fillStyle = "#ef476f"
          ctx.fillRect(x, y + (prop.h - 8) * scale, prop.w * scale, 8 * scale)
        } else if (prop.kind === "pendulum") {
          const swing = pendulumSwing(prop, this.time, itemState) * scale
          ctx.strokeStyle = "#adb5bd"
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(x + (prop.w * scale) / 2, y)
          ctx.lineTo(x + (prop.w * scale) / 2 + swing, y + 60 * scale)
          ctx.stroke()
          ctx.fillStyle = "#f72585"
          ctx.beginPath()
          ctx.arc(x + (prop.w * scale) / 2 + swing, y + 60 * scale, 12 * scale, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }

  drawDeployed({ player, playerWorldY, cameraY, worldWidth, currentChunk, chunkHeight, flipGravityActive = false }) {
    const ctx = this.ctx
    for (const d of player.deployed) {
      const worldY = currentChunk * chunkHeight + d.y
      const { x, y, scale } = this.toScreen(d.x, worldY, cameraY, worldWidth)
      ctx.fillStyle = "#06d6a0"
      ctx.fillRect(x, y, d.w * scale, d.h * scale)
    }
  }

  drawWells({ itemState, cameraY, worldWidth, currentChunk, chunkHeight, flipGravityActive = false }) {
    const ctx = this.ctx

    for (const well of itemState.wells) {
      const worldY = currentChunk * chunkHeight + well.y
      const { x, y, scale } = this.toScreen(well.x, worldY, cameraY, worldWidth)
      const g = ctx.createRadialGradient(
        x + (well.w * scale) / 2,
        y + (well.h * scale) / 2,
        10 * scale,
        x + (well.w * scale) / 2,
        y + (well.h * scale) / 2,
        well.radius * scale
      )
      g.addColorStop(0, "rgba(147, 112, 219, 0.35)")
      g.addColorStop(1, "rgba(147, 112, 219, 0)")
      ctx.fillStyle = g
      ctx.fillRect(x - 20 * scale, y - 20 * scale, well.w * scale + 40 * scale, well.h * scale + 40 * scale)
    }
  }

  drawAimGuide({ chunks, player, cameraY, worldWidth, currentChunk, chunkHeight, loadout, activeSlot, flipGravityActive = false }) {
    const item = loadout?.[activeSlot]
    if (!item || !["box_gun", "push_block"].includes(item.effect)) return

    const chunk = chunks.get(currentChunk)
    if (!chunk || !player) return

    const ctx = this.ctx
    const solids = (chunk.platforms || []).filter((p) => !p.removed && p.kind !== "wall")
    const range = item.effect === "box_gun" ? 160 : 140
    const aim = findAimTarget(player, solids, range)
    const dir = player.facing || 1
    const startX = player.x + player.w / 2
    const feetLocalY = player.y + player.h - 4
    const endX = startX + dir * range

    const start = this.toScreen(startX, currentChunk * chunkHeight + feetLocalY, cameraY, worldWidth)
    const end = this.toScreen(endX, currentChunk * chunkHeight + feetLocalY, cameraY, worldWidth)

    ctx.save()
    ctx.strokeStyle = "rgba(255,209,102,0.75)"
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    ctx.setLineDash([])

    if (aim) {
      const crateTop = aim.placeY - 28
      const tx = aim.placeX + 14
      const t = this.toScreen(tx, currentChunk * chunkHeight + crateTop + 14, cameraY, worldWidth)
      ctx.strokeStyle = "#ffd166"
      ctx.lineWidth = 2
      ctx.strokeRect(t.x - 14, t.y - 14, 28, 28)
    }
    ctx.restore()
  }

  drawPlayer({ player, playerWorldY, cameraY, worldWidth, currentChunk, chunkHeight, flipGravityActive = false }) {
    const ctx = this.ctx
    const worldY = currentChunk * chunkHeight + player.y
    const { x, y, scale } = this.toScreen(player.x, worldY, cameraY, worldWidth)
    const w = player.w * scale
    const h = player.h * scale

    ctx.save()
    ctx.translate(x + w / 2, y + h / 2)
    ctx.scale(player.squash, player.stretch)
    ctx.fillStyle = "#ff6b6b"
    roundRect(ctx, -w / 2, -h / 2, w, h, 8 * scale)
    ctx.fill()
    ctx.restore()
  }

  drawParticles(cameraY, worldWidth, dt = 1) {
    const ctx = this.ctx
    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      ctx.fillStyle = p.color
      ctx.globalAlpha = Math.max(0, p.life / 30)
      ctx.fillRect(p.x, p.y, 3, 3)
      ctx.globalAlpha = 1
      return p.life > 0
    })
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
