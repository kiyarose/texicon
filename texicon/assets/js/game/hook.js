import { GameEngine } from "./engine.js"
import { hud } from "../lol/config.js"

export const GameCanvas = {
  mounted() {
    this.canvas = this.el.querySelector("#game-canvas")
    this.engine = new GameEngine(this.canvas, this)
    this.engine.resize()

    this.onResize = () => this.engine.resize()
    window.addEventListener("resize", this.onResize)

    this.copyBtn = this.el.querySelector("#hud-copy-seed")
    if (this.copyBtn) {
      this.copyBtn.addEventListener("click", () => {
        const seed = this.el.dataset.seed
        navigator.clipboard?.writeText(String(seed))
        this.copyBtn.textContent = hud.copiedBtn
        setTimeout(() => { this.copyBtn.textContent = hud.copyBtn }, 1500)
      })
    }

    document.querySelectorAll(".inv-slot").forEach((slotEl) => {
      slotEl.addEventListener("click", () => {
        const slot = Number(slotEl.dataset.slot)
        if (!Number.isNaN(slot)) this.engine.selectSlot(slot)
      })
    })

    this.handleEvent("game_init", (payload) => {
      const { seed, chunks, high_score, loadout, items, block_colors, blocks, debug } = payload
      this.el.dataset.seed = seed
      const seedEl = document.getElementById("hud-seed")
      if (seedEl) seedEl.textContent = `${hud.seedLabel} ${seed}`
      this.engine.resize()
      this.engine.init({ seed, chunks, high_score, loadout, items, block_colors, blocks, debug })
      this.engine.start()
      this.hideOverlay()
      this.el.dataset.status = "playing"
      this.canvas.tabIndex = 0
      this.canvas.focus()
    })

    this.handleEvent("chunk", ({ chunk }) => {
      this.engine.addChunk(chunk)
    })

    this.handleEvent("game_over", ({ distance, high_score }) => {
      this.presentDeath(distance, high_score)
    })

    this.handleEvent("debug_grant_item", (payload) => {
      this.engine.debug.handleEvent("debug_grant_item", payload)
    })

    this.handleEvent("debug_refill", (payload) => {
      this.engine.debug.handleEvent("debug_refill", payload)
    })

    this.handleEvent("debug_spawn_prop", (payload) => {
      this.engine.debug.handleEvent("debug_spawn_prop", payload)
    })

    if (this.el.dataset.status === "playing") {
      this.pushEvent("restore_game", {})
    }
  },

  presentDeath(distance, high_score) {
    this.engine.stop()
    this.el.dataset.status = "dead"
    if (high_score) {
      this.engine.highScore = high_score.best_distance
      const bestEl = document.getElementById("hud-best")
      if (bestEl) bestEl.textContent = `${hud.bestLabel} ${high_score.best_distance}${hud.distanceSuffix}`
    }
    const distEl = document.getElementById("overlay-distance")
    if (distEl) distEl.textContent = `Distance: ${distance}m`
    this.showOverlay("dead")
  },

  hideOverlay() {
    const overlay = document.getElementById("game-overlay")
    if (overlay) overlay.className = "game-overlay playing"
  },

  showOverlay(status) {
    const overlay = document.getElementById("game-overlay")
    if (overlay) overlay.className = `game-overlay ${status}`
  },

  destroyed() {
    window.removeEventListener("resize", this.onResize)
    this.engine?.destroy()
  },
}
