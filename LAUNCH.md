# Launching Texicon

Texicon is a Phoenix LiveView game. Chunk generation, high scores, and game events run on the server. Static hosts (GitHub Pages, Cloudflare Pages) cannot run the full game by themselves.

## Pre-launch checklist

From the `texicon/` directory:

```bash
mix setup
mix test
mix texicon.lol && mix texicon.tex
MIX_ENV=prod mix assets.deploy
MIX_ENV=prod mix release
```

### Production environment variables

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY_BASE` | Generate with `mix phx.gen.secret` |
| `PHX_HOST` | Public hostname (e.g. `texicon.example.com`) |
| `PORT` | HTTP port (default `4000`) |
| `PHX_SERVER` | Set to `true` when running a release |

Run a release:

```bash
PHX_SERVER=true PORT=4000 _build/prod/rel/texicon/bin/texicon start
```

## Deploy paths

| Path | Host | Playable? |
|------|------|-----------|
| **A — Recommended** | Fly.io, Render, Railway | Yes |
| **B — Static only** | GitHub Pages, Cloudflare Pages | No (landing/docs only) |
| **C — Hybrid** | CF Pages (marketing) + Fly/Render (game subdomain) | Yes |

### A — Full game (Fly.io example)

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/).
2. From `texicon/`, run `fly launch` and follow prompts.
3. Set secrets:

```bash
fly secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)
fly secrets set PHX_HOST=your-app.fly.dev
```

4. Deploy with `fly deploy`.

Render and Railway follow the same pattern: build command `mix deps.get && mix compile && mix assets.deploy && MIX_ENV=prod mix release`, start command `PHX_SERVER=true bin/texicon start`.

## GitHub Pages

GitHub Pages serves static files only. Use it for a README landing site, or use GitHub Actions to build and deploy the Phoenix release elsewhere.

### CI (recommended)

The repo includes `.github/workflows/ci.yml`, which runs on every push:

- Installs Elixir and Node
- Runs `mix setup`, `mix test`, `mix texicon.lol`, and `mix texicon.tex`

### Static landing on Pages

1. Create a `docs/index.html` landing page (screenshots, link to hosted game).
2. In repo **Settings → Pages**, set source to `docs/` on `main`.
3. Optional workflow `.github/workflows/pages.yml` deploys `docs/` on push.

### Project site base path

If the app is served under a subpath (e.g. `https://user.github.io/PROJECT_TEXICON/`), configure Phoenix:

```elixir
# config/runtime.exs (prod)
config :texicon, TexiconWeb.Endpoint, url: [path: "/PROJECT_TEXICON"]
```

This only applies when the Phoenix app itself is hosted at that path.

## Cloudflare Pages

Default Cloudflare Pages build images do not include Elixir.

| Setting | Value |
|---------|-------|
| Root directory | repository root or `texicon` |
| Build command | Not applicable for LiveView app |
| Output directory | N/A |

Options:

1. **Static landing** — point Pages at a `docs/` folder (game will not run).
2. **Custom Docker build** — see [Cloudflare Pages custom builds](https://developers.cloudflare.com/pages/configuration/build-configuration/).
3. **Recommended** — host the game on Fly/Render; use Cloudflare DNS to proxy to the Phoenix app, or use Pages only for marketing content.

## Content pipeline

After editing LOLCODE or `.tex` content:

```bash
cd texicon
mix texicon.lol    # physics.lol, props.lol, level.lol → Elixir + JS
mix texicon.tex    # system.tex, levels/*.lol → registry.json
mix assets.build   # rebuild JS/CSS
```

Level authoring uses ASCII grids in `levels/*.lol`. Block behaviors are defined in `lol/props.lol` and referenced from `blocks/*.tex`.

## Local development

```bash
cd texicon
mix setup
mix phx.server
```

Open [http://localhost:4000](http://localhost:4000). Share seeds via `/play?seed=12345`.
