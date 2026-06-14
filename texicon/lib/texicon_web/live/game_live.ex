defmodule TexiconWeb.GameLive do
  use TexiconWeb, :live_view

  alias Texicon.Game.{ChunkGenerator, HighScore, Inventory, Seed}
  alias Texicon.Lol.Generated
  alias Texicon.Tex.Registry

  defp buffer_ahead, do: Generated.game_config()[:buffer_ahead]

  @impl true
  def mount(params, _session, socket) do
    run_seed = params |> Map.get("seed") |> Seed.from_param()
    debug_mode = Map.get(params, "debug") == "1"
    loadout = Inventory.start_loadout(run_seed)
    loadout_effects = Inventory.effects(loadout)
    high_score = HighScore.get()

    chunks =
      0..buffer_ahead()
      |> Enum.map(&ChunkGenerator.generate(run_seed, &1, loadout_effects: loadout_effects))
      |> Map.new(fn chunk -> {chunk.index, chunk} end)

    socket =
      socket
      |> assign(:run_seed, run_seed)
      |> assign(:loadout, loadout)
      |> assign(:loadout_effects, loadout_effects)
      |> assign(:debug_mode, debug_mode)
      |> assign(:high_score, high_score)
      |> assign(:chunks, chunks)
      |> assign(:status, :ready)
      |> assign(:current_distance, 0)
      |> assign(:page_title, Generated.ui()[:title])
      |> assign(:ui, Generated.ui())
      |> assign(:hud, Generated.hud())
      |> assign(:version, Generated.version())
      |> assign(:build, Generated.build())
      |> assign(:items, Registry.items())
      |> assign(:block_colors, Registry.block_colors())
      |> assign(:blocks, Registry.blocks())

    {:ok, socket}
  end

  @impl true
  def handle_event("restore_game", _params, socket) do
    if socket.assigns.status == :playing do
      chunks_list = socket.assigns.chunks |> Map.values() |> Enum.sort_by(& &1.index)

      {:noreply, push_event(socket, "game_init", game_payload(socket, chunks_list))}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("start_game", _params, socket) do
    chunks_list = socket.assigns.chunks |> Map.values() |> Enum.sort_by(& &1.index)

    {:noreply,
     socket
     |> assign(:status, :playing)
     |> push_event("game_init", game_payload(socket, chunks_list))}
  end

  @impl true
  def handle_event("request_chunk", %{"index" => index}, socket) do
    index = if is_binary(index), do: String.to_integer(index), else: index
    prior = socket.assigns.chunks
    chunks = ensure_chunks(prior, socket, index)

    prior_keys = prior |> Map.keys() |> MapSet.new()

    new_keys =
      chunks
      |> Map.keys()
      |> MapSet.new()
      |> MapSet.difference(prior_keys)
      |> MapSet.to_list()

    to_push = Enum.sort(new_keys)

    socket =
      if to_push == [] do
        socket
      else
        Enum.reduce(to_push, assign(socket, :chunks, chunks), fn i, s ->
          push_event(s, "chunk", %{chunk: Map.fetch!(chunks, i)})
        end)
      end

    {:noreply, socket}
  end

  @impl true
  def handle_event("distance_update", _params, socket) do
    if socket.assigns.debug_mode do
      {:noreply, socket}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("player_died", %{"distance" => distance}, socket) do
    if socket.assigns.debug_mode do
      {:noreply, socket}
    else
      high_score = HighScore.update(distance, socket.assigns.run_seed)

      {:noreply,
       socket
       |> assign(:status, :dead)
       |> assign(:current_distance, trunc(distance))
       |> assign(:high_score, high_score)
       |> push_event("game_over", %{
         distance: trunc(distance),
         high_score: high_score,
         seed: socket.assigns.run_seed
       })}
    end
  end

  @impl true
  def handle_event("restart", _params, socket) do
    run_seed = Seed.new()
    loadout = Inventory.start_loadout(run_seed)
    loadout_effects = Inventory.effects(loadout)

    chunks =
      0..buffer_ahead()
      |> Enum.map(&ChunkGenerator.generate(run_seed, &1, loadout_effects: loadout_effects))
      |> Map.new(fn chunk -> {chunk.index, chunk} end)

    chunks_list = chunks |> Map.values() |> Enum.sort_by(& &1.index)
    high_score = HighScore.get()

    {:noreply,
     socket
     |> assign(:run_seed, run_seed)
     |> assign(:loadout, loadout)
     |> assign(:loadout_effects, loadout_effects)
     |> assign(:chunks, chunks)
     |> assign(:status, :playing)
     |> assign(:current_distance, 0)
     |> assign(:high_score, high_score)
     |> push_event("game_init", game_payload(socket, chunks_list, run_seed, loadout))}
  end

  @impl true
  def handle_event("debug_grant_item", %{"item_id" => item_id}, socket) do
    if socket.assigns.debug_mode do
      item = Registry.item_by_id(item_id)

      {:noreply,
       push_event(socket, "debug_grant_item", %{
         item: normalize_debug_item(item)
       })}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("debug_refill", _params, socket) do
    if socket.assigns.debug_mode do
      {:noreply, push_event(socket, "debug_refill", %{})}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("debug_spawn_prop", %{"kind" => kind}, socket) do
    if socket.assigns.debug_mode do
      {:noreply, push_event(socket, "debug_spawn_prop", %{kind: kind})}
    else
      {:noreply, socket}
    end
  end

  defp game_payload(socket, chunks_list, run_seed \\ nil, loadout \\ nil) do
    %{
      seed: run_seed || socket.assigns.run_seed,
      chunks: chunks_list,
      high_score: socket.assigns.high_score,
      loadout: loadout || socket.assigns.loadout,
      items: socket.assigns.items,
      block_colors: socket.assigns.block_colors,
      blocks: socket.assigns.blocks,
      ui: socket.assigns.ui,
      version: socket.assigns.version,
      debug: socket.assigns.debug_mode
    }
  end

  defp ensure_chunks(chunks, socket, index) do
    run_seed = socket.assigns.run_seed
    loadout_effects = socket.assigns.loadout_effects
    needed = index + buffer_ahead()

    if Map.has_key?(chunks, needed) do
      chunks
    else
      missing =
        (Map.keys(chunks) |> Enum.max(fn -> -1 end)) + 1..needed
        |> Enum.reject(&Map.has_key?(chunks, &1))

      Enum.reduce(missing, chunks, fn i, acc ->
        Map.put(acc, i, ChunkGenerator.generate(run_seed, i, loadout_effects: loadout_effects))
      end)
    end
  end

  defp normalize_debug_item(nil), do: nil

  defp normalize_debug_item(item) do
    %{
      id: item["id"],
      name: item["name"],
      uses: item["uses"],
      effect: item["effect"],
      description: item["description"],
      passive: item["passive"] in [true, "true"]
    }
  end
end
