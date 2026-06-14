export function createGameDebug(engine) {
  return {
    enabled: false,
    panelOpen: false,
    showHitboxes: false,
    showEntryLine: false,
    grantIndex: 0,

    init(debug, items) {
      this.enabled = !!debug
      this.items = items || []
      this.bindPanel()
    },

    bindPanel() {
      if (!this.enabled) return

      const panel = document.getElementById("debug-panel")
      if (panel) panel.classList.remove("hidden")

      panel?.querySelectorAll("[data-debug-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.dataset.debugAction
          if (action === "toggle-hitboxes") {
            this.showHitboxes = !this.showHitboxes
            btn.classList.toggle("active", this.showHitboxes)
          } else if (action === "toggle-entry") {
            this.showEntryLine = !this.showEntryLine
            btn.classList.toggle("active", this.showEntryLine)
          } else if (action === "refill") {
            engine.hook.pushEvent("debug_refill", {})
          } else if (action === "grant") {
            const id = btn.dataset.itemId
            if (id) engine.hook.pushEvent("debug_grant_item", { item_id: id })
          } else if (action === "spawn") {
            engine.hook.pushEvent("debug_spawn_prop", { kind: btn.dataset.propKind })
          }
        })
      })
    },

    handleEvent(name, payload) {
      if (!this.enabled) return
      if (name === "debug_grant_item" && payload.item) {
        engine.grantItem(payload.item)
      }
      if (name === "debug_refill") {
        engine.refillLoadout()
      }
      if (name === "debug_spawn_prop") {
        engine.spawnDebugProp(payload.kind)
      }
    },

    onKey(input) {
      if (!this.enabled) return
      if (input.consumeDebugToggle()) {
        this.panelOpen = !this.panelOpen
        document.getElementById("debug-panel")?.classList.toggle("open", this.panelOpen)
      }
      if (input.consumeDebugGrant()) {
        const item = this.items[this.grantIndex % this.items.length]
        this.grantIndex += 1
        if (item) engine.grantItem(normalizeItem(item))
      }
    },

    drawOverlay(ctx, engine, cameraY, worldWidth, chunkHeight) {
      if (!this.enabled) return
      const chunk = engine.chunks.get(engine.currentChunk)
      if (!chunk) return

      if (this.showHitboxes) {
        ctx.strokeStyle = "rgba(0,255,128,0.6)"
        ctx.lineWidth = 1
        const idx = engine.currentChunk
        for (const p of chunk.platforms || []) {
          if (p.removed) continue
          const wy = idx * chunkHeight + p.y
          const sx = p.x
          const sy = wy - cameraY
          ctx.strokeRect(sx, sy, p.w, p.h)
        }
        const px = engine.player.x
        const py = engine.worldY() - cameraY
        ctx.strokeStyle = "rgba(255,200,0,0.8)"
        ctx.strokeRect(px, py, engine.player.w, engine.player.h)
      }

      if (this.showEntryLine) {
        const idx = engine.currentChunk
        const lineY = idx * chunkHeight + (chunk.entry_y ?? chunkHeight - 48) - cameraY
        ctx.strokeStyle = "rgba(255,80,80,0.9)"
        ctx.beginPath()
        ctx.moveTo(0, lineY)
        ctx.lineTo(worldWidth, lineY)
        ctx.stroke()
      }
    },
  }
}

function normalizeItem(item) {
  return {
    id: item.id,
    name: item.name,
    uses: item.uses,
    maxUses: item.uses,
    effect: item.effect,
    description: item.description,
    passive: item.passive === true || item.passive === "true",
  }
}
