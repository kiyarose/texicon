# Texicon

An infinite vertical climb game built with Phoenix LiveView, HTML Canvas, and Web Audio.

Content is authored in **LaTeX-style `.tex` files** at the repo root. Seed logic, version, and UI strings are defined in **LOLCODE** and compiled at build time.

## Run locally

```bash
cd texicon
mix setup
mix phx.server
```

Open [http://localhost:4000](http://localhost:4000)

Share a seed via `/play?seed=12345`.

## Content authoring

### Master manifest — `../system.tex`

Registers items, blocks, and milestone levels via `\input{}` and `\MilestoneLevel` / `\MilestoneEvery`.

### Add a new item

1. Create `items/my_item.tex`:
   ```latex
   \ItemDef{my_item}{My Item}{3}{dash}{Uses dash effect}
   ```
2. Add `\input{items/my_item.tex}` to `system.tex`
3. Run `mix texicon.tex` (or `mix compile`)

### Add a milestone level

1. Create `levels/my_level.tex` with `\LevelMeta`, `\Platform`, etc.
2. Register in `system.tex`: `\MilestoneLevel{15}{levels/my_level.tex}`
3. Run `mix texicon.tex` — solvability is checked at compile time

### Change UI / version / seed

Edit files in `../lol/`:
- `seed.lol` — seed generation constants
- `version.lol` — version and build label
- `ui.lol` — title, hints, button labels

Run `mix texicon.lol` to regenerate Elixir and JS.

## Controls

| Key | Action |
|-----|--------|
| A / D or ← / → | Move |
| Space / W / ↑ | Jump (wall jump when sliding on walls) |
| E | Use current chunk item |

## Architecture

- **`.tex` registry** — items, blocks, milestone levels (`mix texicon.tex`)
- **LOLCODE** — seed, version, UI strings (`mix texicon.lol`)
- **Elixir** — chunk orchestration, solvability, high scores
- **LiveView** — run state, chunk streaming
- **Canvas (JS)** — physics, rendering, procedural music

## Tests

```bash
mix test
```
