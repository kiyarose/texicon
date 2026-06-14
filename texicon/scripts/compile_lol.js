#!/usr/bin/env node
/**
 * Compiles LOLCODE .lol sources into Elixir and JS outputs.
 * Extracts I HAS A ... ITZ ... declarations from LOLCODE files.
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "../..")
const lolDir = path.join(root, "lol")
const outEx = path.join(__dirname, "../lib/texicon/lol/generated.ex")
const outJsUi = path.join(__dirname, "../assets/js/lol/ui.js")
const outJsConfig = path.join(__dirname, "../assets/js/lol/config.js")
const outJsBehaviors = path.join(__dirname, "../assets/js/lol/behaviors.js")

const BEHAVIOR_TRIGGERS = {
  bounce: "on_land",
  fragile: "on_land",
  button_spring: "on_land",
  slippery: "on_land",
  lethal: "on_touch",
  moving: "per_frame",
  gravity_zone: "zone",
  flip_gravity: "zone",
  gravity_well: "item_use",
  freeze: "item_use",
  spring: "prop_touch",
  oneway: "pre_land",
  extra_jump: "passive",
  dash: "item_use",
  deploy_spring: "item_use",
  push_block: "item_use",
  grapple_line: "item_use",
  bomb_platform: "item_use",
  box_gun: "item_use",
  freeze_camera: "item_use",
  pin_platform: "item_use",
}

const BEHAVIOR_IDS = Object.keys(BEHAVIOR_TRIGGERS).sort((a, b) => b.length - a.length)

function readLol(name) {
  return fs.readFileSync(path.join(lolDir, name), "utf8")
}

function stripLolComments(source) {
  return source
    .split("\n")
    .filter((line) => {
      const t = line.trim()
      return !/^(OBTW|TLDR|BTW|HAI|KTHXBYE)\b/i.test(t)
    })
    .join("\n")
}

function parseConstants(source) {
  const clean = stripLolComments(source)
  const vars = {}

  for (const line of clean.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let m = /I\s+HAS\s+A\s+([A-Z0-9\s]+?)\s+ITZ\s+"([^"]*)"/i.exec(trimmed)
    if (m) {
      const key = m[1].trim().replace(/\s+/g, "_").toLowerCase()
      vars[key] = m[2]
      continue
    }

    m = /I\s+HAS\s+A\s+([A-Z0-9\s]+?)\s+ITZ\s+(-?\d+\.?\d*)\s*$/i.exec(trimmed)
    if (m) {
      const key = m[1].trim().replace(/\s+/g, "_").toLowerCase()
      const raw = m[2]
      vars[key] = raw.includes(".") ? parseFloat(raw) : parseInt(raw, 10)
      continue
    }

    m = /I\s+HAS\s+A\s+([A-Z0-9\s]+?)\s+ITZ\s+([a-z][a-z0-9_]*)\s*$/i.exec(trimmed)
    if (m) {
      const key = m[1].trim().replace(/\s+/g, "_").toLowerCase()
      vars[key] = { $ref: m[2].toLowerCase() }
    }
  }

  return vars
}

function resolveValue(val, physicsVars) {
  if (val && typeof val === "object" && val.$ref) {
    const resolved = physicsVars[val.$ref]
    return resolved !== undefined ? resolved : val.$ref
  }
  return val
}

function resolveDeep(obj, physicsVars) {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    if (obj.$ref) return resolveValue(obj, physicsVars)
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = resolveDeep(v, physicsVars)
    }
    return out
  }
  return obj
}

function matchBehaviorId(key) {
  if (key.startsWith("char_")) return null
  for (const id of BEHAVIOR_IDS) {
    if (key === id) return { id, param: null }
    if (key.startsWith(id + "_")) {
      return { id, param: key.slice(id.length + 1) }
    }
  }
  return null
}

function parseProps(source, physicsVars) {
  const raw = parseConstants(source)
  const behaviors = {}
  const chars = {}

  for (const [key, val] of Object.entries(raw)) {
    if (key.startsWith("char_")) {
      const kind = key.slice(5)
      chars[kind] = resolveValue(val, physicsVars)
      continue
    }

    const match = matchBehaviorId(key)
    if (!match) continue

    const { id, param } = match
    if (!behaviors[id]) {
      behaviors[id] = { trigger: BEHAVIOR_TRIGGERS[id] || "on_land", params: {} }
    }

    if (param === null) {
      behaviors[id].params.enabled = resolveValue(val, physicsVars)
    } else {
      behaviors[id].params[param] = resolveValue(val, physicsVars)
    }
  }

  return { behaviors, chars }
}

function toElixirMap(obj, indent = 2) {
  const pad = " ".repeat(indent)
  if (obj === null || obj === undefined) return "nil"
  if (typeof obj === "number") return String(obj)
  if (typeof obj === "boolean") return obj ? "true" : "false"
  if (typeof obj === "string") return JSON.stringify(obj)

  if (Array.isArray(obj)) {
    const items = obj.map((v) => `${pad}  ${toElixirMap(v, indent + 2)}`).join(",\n")
    return `[\n${items}\n${pad}]`
  }

  const entries = Object.entries(obj)
    .map(([k, v]) => {
      const key = /^[a-z_][a-z0-9_]*$/i.test(k) ? k : JSON.stringify(k)
      return `${pad}  ${key}: ${toElixirMap(v, indent + 2)}`
    })
    .join(",\n")

  return `%{\n${entries}\n${pad}}`
}

const seedLol = readLol("seed.lol")
const versionLol = readLol("version.lol")
const uiLol = readLol("ui.lol")
const gameLol = readLol("game.lol")
const hudLol = readLol("hud.lol")
const physicsLol = readLol("physics.lol")
const propsLol = readLol("props.lol")
const levelLol = readLol("level.lol")

const seedVars = parseConstants(seedLol)
const versionVars = parseConstants(versionLol)
const uiVars = parseConstants(uiLol)
const gameVars = parseConstants(gameLol)
const hudVars = parseConstants(hudLol)
const physicsVarsRaw = parseConstants(physicsLol)
const levelVars = parseConstants(levelLol)

const physicsVars = {}
for (const [k, v] of Object.entries(physicsVarsRaw)) {
  physicsVars[k] = resolveValue(v, physicsVarsRaw)
}

const { behaviors, chars } = parseProps(propsLol, physicsVars)
const behaviorsResolved = resolveDeep(behaviors, physicsVars)

const maxSeed = seedVars.max_seed || 999_999_999
const chunkHeight = gameVars.chunk_height || 540
const worldWidth = gameVars.world_width || 960
const bufferAhead = gameVars.buffer_ahead || 2
const deathFallChunks = gameVars.death_fall_chunks || 1.5
const templatePct = gameVars.template_pct || 60
const gatedPct = gameVars.gated_pct || 25
const randomPct = gameVars.random_pct || 15
const cellSize = levelVars.cell_size || 10
const platformH = levelVars.platform_h || 14
const propSize = levelVars.prop_size || 28

function elixir_string(s) {
  return JSON.stringify(s)
}

const ex = `defmodule Texicon.Lol.Generated do
  @moduledoc """
  Generated from LOLCODE sources in lol/*.lol — DO NOT EDIT BY HAND.
  Run \`mix texicon.lol\` to regenerate.
  """

  @max_seed ${maxSeed}
  @version ${elixir_string(versionVars.version || "0.2.0-lol")}
  @build ${elixir_string(versionVars.build || "texicon")}

  @ui ${toElixirMap({
    title: uiVars.title || "Texicon",
    subtitle: uiVars.subtitle || "",
    hint: uiVars.hint || "",
    start_btn: uiVars.start_btn || "Press to Start",
    dead_title: uiVars.dead_title || "Fallen",
    retry_btn: uiVars.retry_btn || "Try Again",
    lol_label: uiVars.lol_label || "LOLCODE",
  })}

  @hud ${toElixirMap({
    distance_suffix: hudVars.distance_suffix || "m",
    item_label: hudVars.item_label || "Item:",
    uses_label: hudVars.uses_label || "Uses:",
    best_label: hudVars.best_label || "Best:",
    seed_label: hudVars.seed_label || "Seed:",
    empty: hudVars.empty || "—",
    copy_btn: hudVars.copy_btn || "Copy",
    copied_btn: hudVars.copied_btn || "Copied!",
    slot_label: hudVars.slot_label || "Slot",
    empty_slot: hudVars.empty_slot || "Empty",
    inventory_hint: hudVars.inventory_hint || "1/2/3 select · E use",
  })}

  @game_config ${toElixirMap({
    chunk_height: chunkHeight,
    world_width: worldWidth,
    buffer_ahead: bufferAhead,
    death_fall_chunks: deathFallChunks,
    template_pct: templatePct,
    gated_pct: gatedPct,
    random_pct: randomPct,
  })}

  @level_config ${toElixirMap({
    cell_size: cellSize,
    platform_h: platformH,
    prop_size: propSize,
  })}

  @behaviors ${toElixirMap(behaviorsResolved)}

  @level_chars ${toElixirMap(chars)}

  def version, do: @version
  def build, do: @build
  def ui, do: @ui
  def hud, do: @hud
  def game_config, do: @game_config
  def level_config, do: @level_config
  def behaviors, do: @behaviors
  def level_chars, do: @level_chars

  def new do
    :rand.uniform(@max_seed)
  end

  def from_param(nil), do: new()
  def from_param(""), do: new()

  def from_param(seed) when is_binary(seed) do
    case Integer.parse(seed) do
      {n, _} when n > 0 -> n
      _ -> new()
    end
  end

  def derive(run_seed, chunk_index, purpose)
      when is_integer(run_seed) and is_integer(chunk_index) do
    purpose_hash = :erlang.phash2(purpose)
    :erlang.phash2({run_seed, chunk_index, purpose_hash})
  end

  def with_rng(run_seed, chunk_index, purpose, fun) when is_function(fun, 1) do
    derived = derive(run_seed, chunk_index, purpose)
    seed = {derived, derived, derived}
    :rand.seed(:exsss, seed)
    fun.(fn -> :rand.uniform_real() end)
  end

  def rand_float(uniform, min, max) do
    min + uniform.() * (max - min)
  end

  def rand_int(uniform, min, max) do
    trunc(min + uniform.() * (max - min + 1))
  end
end
`

const jsUi = `// Generated from lol/ui.lol — DO NOT EDIT BY HAND
export const ui = ${JSON.stringify(
  {
    title: uiVars.title || "Texicon",
    subtitle: uiVars.subtitle || "",
    hint: uiVars.hint || "",
    start_btn: uiVars.start_btn || "Press to Start",
    dead_title: uiVars.dead_title || "Fallen",
    retry_btn: uiVars.retry_btn || "Try Again",
    lol_label: uiVars.lol_label || "LOLCODE",
  },
  null,
  2,
)}

export const version = ${JSON.stringify(versionVars.version || "0.2.0-lol")}
export const build = ${JSON.stringify(versionVars.build || "texicon")}
`

const jsConfig = `// Generated from lol/*.lol — DO NOT EDIT BY HAND
export const game = ${JSON.stringify(
  {
    chunkHeight,
    worldWidth,
    bufferAhead,
    deathFallChunks,
  },
  null,
  2,
)}

export const hud = ${JSON.stringify(
  {
    distanceSuffix: hudVars.distance_suffix || "m",
    itemLabel: hudVars.item_label || "Item:",
    usesLabel: hudVars.uses_label || "Uses:",
    bestLabel: hudVars.best_label || "Best:",
    seedLabel: hudVars.seed_label || "Seed:",
    empty: hudVars.empty || "—",
    copyBtn: hudVars.copy_btn || "Copy",
    copiedBtn: hudVars.copied_btn || "Copied!",
    emptySlot: hudVars.empty_slot || "Empty",
    inventoryHint: hudVars.inventory_hint || "1/2/3 select · E use",
  },
  null,
  2,
)}

export const physics = ${JSON.stringify(
  {
    gravity: physicsVars.gravity ?? 0.55,
    maxFall: physicsVars.max_fall ?? 14,
    jumpVel: physicsVars.jump_vel ?? -11.5,
    wallJumpVelX: physicsVars.wall_jump_vel_x ?? 6,
    wallJumpVelY: physicsVars.wall_jump_vel_y ?? -10.5,
    moveAccel: physicsVars.move_accel ?? 0.55,
    maxSpeedX: physicsVars.max_speed_x ?? 4.5,
    groundFriction: physicsVars.ground_friction ?? 0.82,
    airFriction: physicsVars.air_friction ?? 0.92,
    wallSlideSpeed: physicsVars.wall_slide_speed ?? 2.5,
    coyoteFrames: physicsVars.coyote_frames ?? 6,
    jumpBufferFrames: physicsVars.jump_buffer_frames ?? 4,
    bouncyMult: physicsVars.bouncy_mult ?? 1.35,
    playerW: physicsVars.player_w ?? 24,
    playerH: physicsVars.player_h ?? 32,
  },
  null,
  2,
)}

export const level = ${JSON.stringify(
  {
    cellSize,
    platformH,
    propSize,
  },
  null,
  2,
)}
`

const jsBehaviors = `// Generated from lol/props.lol — DO NOT EDIT BY HAND
export const behaviors = ${JSON.stringify(behaviorsResolved, null, 2)}

export const levelChars = ${JSON.stringify(chars, null, 2)}
`

fs.mkdirSync(path.dirname(outEx), { recursive: true })
fs.mkdirSync(path.dirname(outJsUi), { recursive: true })
fs.writeFileSync(outEx, ex)
fs.writeFileSync(outJsUi, jsUi)
fs.writeFileSync(outJsConfig, jsConfig)
fs.writeFileSync(outJsBehaviors, jsBehaviors)

console.log("Wrote", outEx)
console.log("Wrote", outJsUi)
console.log("Wrote", outJsConfig)
console.log("Wrote", outJsBehaviors)
