let listenerRefCount = 0
let listenerHandles = null
const keys = new Set()

export function createInput() {
  if (!listenerHandles) {
    const onKeyDown = (e) => {
      keys.add(e.code)
      if (["Space", "ArrowUp", "ArrowDown", "Digit1", "Digit2", "Digit3"].includes(e.code)) {
        e.preventDefault()
      }
    }

    const onKeyUp = (e) => {
      keys.delete(e.code)
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    listenerHandles = { onKeyDown, onKeyUp }
  }

  listenerRefCount += 1

  return {
    left: () => keys.has("KeyA") || keys.has("ArrowLeft"),
    right: () => keys.has("KeyD") || keys.has("ArrowRight"),
    jump: () => keys.has("Space") || keys.has("KeyW") || keys.has("ArrowUp"),
    down: () => keys.has("KeyS") || keys.has("ArrowDown"),
    useItem: () => keys.has("KeyE"),
    slot: (n) => keys.has(`Digit${n}`),
    debugToggle: () => keys.has("KeyD"),
    debugGrant: () => keys.has("KeyG"),
    consumeJump: () => {},
    anyKey: () => keys.size > 0,
    destroy: () => {
      listenerRefCount -= 1
      if (listenerRefCount <= 0 && listenerHandles) {
        window.removeEventListener("keydown", listenerHandles.onKeyDown)
        window.removeEventListener("keyup", listenerHandles.onKeyUp)
        listenerHandles = null
        listenerRefCount = 0
        keys.clear()
      }
    },
  }
}

export class InputBuffer {
  constructor(input) {
    this.input = input
    this.jumpBuffered = false
    this.itemBuffered = false
    this.debugToggleBuffered = false
    this.debugGrantBuffered = false
    this.slotBuffered = null
    this.prevJump = false
    this.prevItem = false
    this.prevDebugToggle = false
    this.prevDebugGrant = false
    this.prevSlots = [false, false, false]
  }

  left() {
    return this.input.left()
  }

  right() {
    return this.input.right()
  }

  down() {
    return this.input.down()
  }

  jump() {
    return this.input.jump()
  }

  useItem() {
    return this.input.useItem()
  }

  anyKey() {
    return this.input.anyKey()
  }

  update() {
    const jump = this.jump()
    const item = this.useItem()
    const debugToggle = this.input.debugToggle()
    const debugGrant = this.input.debugGrant()

    if (jump && !this.prevJump) this.jumpBuffered = true
    if (item && !this.prevItem) this.itemBuffered = true
    if (debugToggle && !this.prevDebugToggle) this.debugToggleBuffered = true
    if (debugGrant && !this.prevDebugGrant) this.debugGrantBuffered = true

    for (let i = 0; i < 3; i++) {
      const pressed = this.input.slot(i + 1)
      if (pressed && !this.prevSlots[i]) this.slotBuffered = i
      this.prevSlots[i] = pressed
    }

    this.prevJump = jump
    this.prevItem = item
    this.prevDebugToggle = debugToggle
    this.prevDebugGrant = debugGrant
  }

  consumeJump() {
    if (this.jumpBuffered) {
      this.jumpBuffered = false
      return true
    }
    return false
  }

  consumeItem() {
    if (this.itemBuffered) {
      this.itemBuffered = false
      return true
    }
    return false
  }

  consumeSlot() {
    if (this.slotBuffered != null) {
      const slot = this.slotBuffered
      this.slotBuffered = null
      return slot
    }
    return null
  }

  consumeDebugToggle() {
    if (this.debugToggleBuffered) {
      this.debugToggleBuffered = false
      return true
    }
    return false
  }

  consumeDebugGrant() {
    if (this.debugGrantBuffered) {
      this.debugGrantBuffered = false
      return true
    }
    return false
  }
}
