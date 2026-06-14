defmodule Texicon.Game.Solvability do
  @moduledoc """
  Lightweight reachability check for generated chunks.
  """

  alias Texicon.Lol.Generated

  alias Texicon.Game.ItemGate

  @world_width 960
  @player_w 24
  @player_h 32
  @base_jump_height 130
  @base_jump_span 160
  @short_wall_h 88

  defp chunk_height, do: Generated.game_config()[:chunk_height]

  @doc """
  Returns true if entry can reach exit with jump + wall jump assumptions.
  """
  def valid?(chunk, opts \\ []) do
    if Map.get(chunk, :chunk_type) == "puzzle", do: true, else: valid_normal?(chunk, opts)
  end

  @doc """
  True when the chunk is solvable with the full loadout but not with passives alone.
  """
  def benefits_from_items?(chunk, loadout_effects) do
    passive = ItemGate.passive_effects(loadout_effects)
    active = ItemGate.active_effects(loadout_effects)

    if active == [] do
      false
    else
      valid?(chunk, loadout_effects: passive ++ active) and
        not valid?(chunk, loadout_effects: passive)
    end
  end

  defp valid_normal?(chunk, opts) do
    loadout_effects = Keyword.get(opts, :loadout_effects, [])
    %{height: max_height, span: max_span} = jump_bounds(loadout_effects)
    walls = Map.get(chunk, :walls, [])

    platforms = chunk.platforms
    entry_y = Map.get(chunk, :entry_y, chunk_height() - 48)
    entry = {div(@world_width, 2) - div(@player_w, 2), entry_y - @player_h}
    exit = exit_point(chunk, platforms)

    reachable_from?(
      platforms,
      entry,
      exit,
      max_height,
      max_span,
      walls,
      loadout_effects
    )
  end

  defp jump_bounds(effects) do
    effects = Enum.map(effects, &to_string/1)

    height_bonus =
      Enum.reduce(effects, 0, fn effect, acc ->
        acc + effect_height_bonus(effect)
      end)

    span_bonus =
      Enum.reduce(effects, 0, fn effect, acc ->
        acc + effect_span_bonus(effect)
      end)

    %{
      height: @base_jump_height + height_bonus,
      span: @base_jump_span + span_bonus
    }
  end

  defp effect_height_bonus("extra_jump"), do: 45
  defp effect_height_bonus("double_jump"), do: 45
  defp effect_height_bonus("deploy_spring"), do: 55
  defp effect_height_bonus("gravity_well"), do: 35
  defp effect_height_bonus("grapple_line"), do: 40
  defp effect_height_bonus("flip_gravity"), do: 25
  defp effect_height_bonus("push_block"), do: 28
  defp effect_height_bonus("box_gun"), do: 28
  defp effect_height_bonus(_), do: 0

  defp effect_span_bonus("grapple_line"), do: 90
  defp effect_span_bonus("dash"), do: 50
  defp effect_span_bonus("push_block"), do: 35
  defp effect_span_bonus("box_gun"), do: 35
  defp effect_span_bonus("bomb_platform"), do: 40
  defp effect_span_bonus(_), do: 0

  defp exit_point(chunk, platforms) do
    exit_y = Map.get(chunk, :exit_y, 60)
    center_x = div(@world_width, 2) - div(@player_w, 2)

    case Enum.find(platforms, fn p -> platform_kind(p) == "exit" end) do
      nil -> {center_x, exit_y - @player_h}
      exit_plat -> {exit_plat.x + div(exit_plat.w, 2) - div(@player_w, 2), exit_plat.y - @player_h}
    end
  end

  defp reachable_from?(platforms, start, goal, max_height, max_span, walls, loadout_effects) do
    solids =
      Enum.filter(platforms, fn p ->
        platform_kind(p) in [
          "solid",
          "spawn",
          "exit",
          "bouncy",
          "oneway",
          "button_spring",
          "ice",
          "crumble",
          "mover",
          "upgrav_tile",
          "flip_tile"
        ]
      end)

    barriers = interior_barriers(walls)

    bfs(
      [start],
      MapSet.new([quantize(start)]),
      solids,
      goal,
      0,
      max_height,
      max_span,
      barriers,
      loadout_effects
    )
  end

  defp bfs(_queue, _visited, _solids, _goal, depth, _max_height, _max_span, _barriers, _effects)
       when depth > 80,
       do: false

  defp bfs([], _visited, _solids, _goal, _depth, _max_height, _max_span, _barriers, _effects),
    do: false

  defp bfs([pos | rest], visited, solids, goal, depth, max_height, max_span, barriers, effects) do
    cond do
      near?(pos, goal) ->
        true

      true ->
        neighbors =
          neighbor_positions(pos, solids, max_height, max_span, barriers, effects)

        {new_queue, new_visited} =
          Enum.reduce(neighbors, {rest, visited}, fn npos, {q, vis} ->
            key = quantize(npos)

            if MapSet.member?(vis, key) do
              {q, vis}
            else
              {[npos | q], MapSet.put(vis, key)}
            end
          end)

        bfs(new_queue, new_visited, solids, goal, depth + 1, max_height, max_span, barriers, effects)
    end
  end

  defp neighbor_positions({x, y}, solids, max_height, max_span, barriers, effects) do
    standing = on_platform?(solids, x, y)

    jumps =
      for dx <- Enum.take_every(-max_span..max_span, 15),
          dy <- Enum.take_every(-max_height..-10, 10) do
        nx = clamp(x + dx, 0, @world_width - @player_w)
        ny = y + dy

        if on_platform?(solids, nx, ny) and
             gap_ok?(x, y, nx, ny, max_height, max_span) and
             not path_blocked?(barriers, x, y, nx, ny, max_height, effects) do
          {nx, ny}
        end
      end

    walks =
      if standing do
        for dx <- [-60, -30, 30, 60] do
          nx = clamp(x + dx, 0, @world_width - @player_w)

          if on_platform?(solids, nx, y) and
               not path_blocked?(barriers, x, y, nx, y, max_height, effects) do
            {nx, y}
          end
        end
      else
        []
      end

    (jumps ++ walks)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq_by(&quantize/1)
  end

  defp interior_barriers(walls) do
    Enum.filter(walls, fn w ->
      id = to_string(Map.get(w, :id) || "")
      String.contains?(id, "barrier") or String.contains?(id, "item-gate")
    end)
  end

  defp path_blocked?(barriers, x1, y1, x2, _y2, max_height, effects) do
    foot_y = y1 + @player_h

    Enum.any?(barriers, fn wall ->
      crosses_x?(x1, x2, wall) and foot_blocks?(foot_y, wall) and
        not clearable?(wall, max_height, effects)
    end)
  end

  defp crosses_x?(x1, x2, wall) do
    min_px = min(x1, x2)
    max_px = max(x1 + @player_w, x2 + @player_w)
    wall.x < max_px and wall.x + wall.w > min_px
  end

  defp foot_blocks?(foot_y, wall) do
    foot_y > wall.y + 8 and foot_y <= wall.y + wall.h + 20
  end

  defp clearable?(wall, max_height, effects) do
    cond do
      wall.h <= @short_wall_h + 12 ->
        wall.h <= max_height - 45

      can_clear_tall?(effects) ->
        wall.h <= max_height + crate_stack_bonus(effects) - 20

      true ->
        false
    end
  end

  defp can_clear_tall?(effects) do
    effects = Enum.map(effects, &to_string/1)

    Enum.any?(effects, fn effect ->
      effect in [
        "deploy_spring",
        "push_block",
        "box_gun",
        "grapple_line",
        "gravity_well",
        "bomb_platform",
        "flip_gravity"
      ]
    end)
  end

  defp crate_stack_bonus(effects) do
    effects = Enum.map(effects, &to_string/1)

    cond do
      "push_block" in effects or "box_gun" in effects -> 84
      "deploy_spring" in effects -> 55
      true -> 0
    end
  end

  defp on_platform?(solids, x, y) do
    foot_y = y + @player_h

    Enum.any?(solids, fn p ->
      foot_y >= p.y - 3 and foot_y <= p.y + 6 and
        x + @player_w > p.x + 2 and x < p.x + p.w - 2
    end) and y >= 0 and y <= chunk_height() - @player_h
  end

  defp gap_ok?(x1, y1, x2, y2, max_height, max_span) do
    abs(x2 - x1) <= max_span and abs(y2 - y1) <= max_height
  end

  defp near?({x1, y1}, {x2, y2}) do
    abs(x1 - x2) < 80 and abs(y1 - y2) < 120
  end

  defp quantize({x, y}), do: {div(x, 15), div(y, 15)}

  defp clamp(v, min, max), do: v |> max(min) |> min(max)

  defp platform_kind(p), do: Map.get(p, :kind)
end
