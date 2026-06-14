import { game } from "../lol/config.js"

const CHUNK_HEIGHT = game.chunkHeight

export function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function normalizeRect(obj) {
  return {
    ...obj,
    x: num(obj.x),
    y: num(obj.y),
    w: num(obj.w),
    h: num(obj.h),
    kind: obj.kind,
  }
}

export function normalizeChunk(chunk) {
  const item = chunk.item
    ? {
        ...chunk.item,
        passive: chunk.item.passive === true || chunk.item.passive === "true",
      }
    : null

  const bonusItem = chunk.bonus_item
    ? {
        ...chunk.bonus_item,
        passive: chunk.bonus_item.passive === true || chunk.bonus_item.passive === "true",
      }
    : null

  const loadoutRoll = (chunk.loadout_roll || [])
    .map((item) =>
      item
        ? {
            ...item,
            passive: item.passive === true || item.passive === "true",
          }
        : null
    )
    .filter(Boolean)

  return {
    ...chunk,
    index: num(chunk.index),
    entry_y: num(chunk.entry_y, CHUNK_HEIGHT - 48),
    exit_y: num(chunk.exit_y, 60),
    chunk_type: chunk.chunk_type || "normal",
    required_effect: chunk.required_effect || null,
    suggested_effect: chunk.suggested_effect || null,
    item_gate: chunk.item_gate || null,
    platforms: (chunk.platforms || []).map(normalizeRect),
    walls: (chunk.walls || []).map(normalizeRect),
    props: (chunk.props || []).map(normalizeRect),
    item,
    bonus_item: bonusItem,
    loadout_roll: loadoutRoll,
  }
}

export { CHUNK_HEIGHT }
