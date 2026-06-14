defmodule Texicon.Game.ItemGate do
  @moduledoc """
  Injects soft obstacles into procedural chunks that encourage loadout item use.
  """

  alias Texicon.Game.Seed

  @world_width 960
  @passive ~w(extra_jump double_jump)
  @horizontal_effects ~w(grapple_line dash bomb_platform)
  @vertical_effects ~w(deploy_spring gravity_well flip_gravity)
  @wall_effects ~w(push_block box_gun)
  @hazard_effects ~w(freeze_camera)

  @target_gap_min 168
  @target_gap_max 188
  @target_drop_min 138
  @target_drop_max 158

  def active_effects(effects) do
    effects
    |> List.wrap()
    |> Enum.map(&to_string/1)
    |> Enum.reject(&(&1 in @passive))
    |> Enum.uniq()
  end

  def passive_effects(effects) do
    effects
    |> List.wrap()
    |> Enum.map(&to_string/1)
    |> Enum.filter(&(&1 in @passive))
  end

  @doc """
  Maybe modifies a procedural chunk to create a soft item-use moment.
  Returns `{chunk, gate_effect_or_nil}`.
  """
  def apply(uniform, chunk, loadout_effects, chunk_index, opts \\ []) do
    effects = active_effects(loadout_effects)
    force? = Keyword.get(opts, :force, false)

    cond do
      effects == [] ->
        {chunk, nil}

      chunk_index < 2 ->
        {chunk, nil}

      Map.get(chunk, :chunk_type) != "normal" ->
        {chunk, nil}

      not force? and Seed.rand_int(uniform, 1, 100) > gate_chance(chunk_index) ->
        {chunk, nil}

      true ->
        ordered = pick_effects(uniform, effects, force?)

        Enum.reduce_while(ordered, {chunk, nil}, fn effect, _ ->
          case apply_for_effect(uniform, chunk, effect) do
            {:ok, updated} ->
              {:halt, {Map.put(updated, :item_gate, effect), effect}}

            :skip ->
              {:cont, {chunk, nil}}
          end
        end)
    end
  end

  defp pick_effects(uniform, effects, true) do
    start = Seed.rand_int(uniform, 0, length(effects) - 1)

    effects
    |> Enum.with_index()
    |> Enum.sort_by(fn {_, i} -> rem(i - start, length(effects)) end)
    |> Enum.map(fn {effect, _} -> effect end)
  end

  defp pick_effects(uniform, effects, false) do
    [Enum.at(effects, Seed.rand_int(uniform, 0, length(effects) - 1))]
  end

  defp gate_chance(i) when i < 6, do: 52
  defp gate_chance(_), do: 65

  defp apply_for_effect(uniform, chunk, effect) when effect in @horizontal_effects do
    horizontal_gap_gate(uniform, chunk, effect)
  end

  defp apply_for_effect(uniform, chunk, effect) when effect in @vertical_effects do
    vertical_gap_gate(uniform, chunk, effect)
  end

  defp apply_for_effect(uniform, chunk, effect) when effect in @wall_effects do
    wall_gate(uniform, chunk, effect)
  end

  defp apply_for_effect(uniform, chunk, effect) when effect in @hazard_effects do
    pendulum_gate(uniform, chunk, effect)
  end

  defp apply_for_effect(uniform, chunk, "pin_platform") do
    mover_gate(uniform, chunk)
  end

  defp apply_for_effect(_uniform, chunk, _unknown), do: {:ok, chunk}

  defp path_platforms(platforms) do
    platforms
    |> Enum.filter(fn p ->
      id = to_string(Map.get(p, :id) || "")
      String.starts_with?(id, "path-") and Map.get(p, :kind) not in ["spawn", "exit"]
    end)
    |> Enum.sort_by(& &1.y, :desc)
  end

  defp horizontal_gap_gate(uniform, chunk, effect) do
    path = path_platforms(chunk.platforms)

    case pick_level_pair(path, uniform) do
      [from, to] ->
        gap = Seed.rand_int(uniform, @target_gap_min, @target_gap_max)
        updated = widen_gap_between(chunk.platforms, from, to, gap)

        if updated == chunk.platforms do
          platform_split_gate(uniform, chunk, effect)
        else
          {:ok, tagged(chunk, platforms: updated, suggested_effect: effect)}
        end

      _ ->
        platform_split_gate(uniform, chunk, effect)
    end
  end

  defp pick_level_pair(path, uniform) do
    pairs =
      path
      |> Enum.chunk_every(2, 1, :discard)
      |> Enum.filter(fn [a, b] -> abs(a.y - b.y) < 36 end)

    case pairs do
      [] -> nil
      list -> Enum.at(list, Seed.rand_int(uniform, 0, length(list) - 1))
    end
  end

  defp widen_gap_between(platforms, from, to, gap) do
    center_from = from.x + div(from.w, 2)
    center_to = to.x + div(to.w, 2)
    current_span = abs(center_to - center_from)

    if current_span >= gap do
      platforms
    else
      dx = gap - current_span
      dir = if center_to >= center_from, do: 1, else: -1
      new_x = clamp(to.x + dir * dx, 24, @world_width - to.w - 24)

      Enum.map(platforms, fn p ->
        if p.id == to.id, do: %{p | x: new_x}, else: p
      end)
    end
  end

  defp platform_split_gate(uniform, chunk, effect) do
    path = path_platforms(chunk.platforms)
    candidates = Enum.filter(path, fn p -> p.w >= 140 end)

    case candidates do
      [] ->
        :skip

      list ->
        plat = Enum.at(list, Seed.rand_int(uniform, 0, length(list) - 1))
        gap = Seed.rand_int(uniform, @target_gap_min, @target_gap_max)

        case split_platform(plat, gap) do
          :skip ->
            :skip

          {left, right} ->
            others = Enum.reject(chunk.platforms, &(&1.id == plat.id))
            {:ok, tagged(chunk, platforms: others ++ [left, right], suggested_effect: effect)}
        end
    end
  end

  defp split_platform(plat, gap) do
    side_w = div(plat.w - gap, 2)

    if side_w < 36 do
      :skip
    else
      left = %{plat | w: side_w, id: "#{plat.id}-a"}
      right = %{plat | w: side_w, x: plat.x + side_w + gap, id: "#{plat.id}-b"}
      {left, right}
    end
  end

  defp vertical_gap_gate(uniform, chunk, effect) do
    path = path_platforms(chunk.platforms)

    pairs =
      path
      |> Enum.chunk_every(2, 1, :discard)
      |> Enum.filter(fn [from, to] ->
        drop = from.y - to.y
        drop >= 80 and drop <= 125
      end)

    case pairs do
      [] ->
        :skip

      list ->
        [from, to] = Enum.at(list, Seed.rand_int(uniform, 0, length(list) - 1))
        current_drop = from.y - to.y
        target = Seed.rand_int(uniform, @target_drop_min, @target_drop_max)
        extra = max(target - current_drop, 10)
        new_y = to.y - extra

        if new_y < 40 do
          :skip
        else
          updated =
            Enum.map(chunk.platforms, fn p ->
              if p.id == to.id, do: %{p | y: new_y}, else: p
            end)

          {:ok, tagged(chunk, platforms: updated, suggested_effect: effect)}
        end
    end
  end

  defp wall_gate(uniform, chunk, effect) do
    barriers =
      (chunk.walls || [])
      |> Enum.filter(&barrier?/1)

    if length(barriers) >= 1 do
      {:ok, Map.put(chunk, :suggested_effect, effect)}
    else
      path = path_platforms(chunk.platforms)

      case pick_wide_path_platform(path, uniform) do
        nil ->
          :skip

        plat ->
          x = plat.x + div(plat.w, 2) - 8

          wall = %{
            x: x,
            y: plat.y - 210,
            w: 16,
            h: 210,
            kind: "wall",
            id: "item-gate-barrier-#{plat.id}"
          }

          {:ok, tagged(chunk, walls: (chunk.walls || []) ++ [wall], suggested_effect: effect)}
      end
    end
  end

  defp barrier?(w) do
    id = to_string(Map.get(w, :id) || "")
    String.contains?(id, "barrier") or String.contains?(id, "item-gate")
  end

  defp pick_wide_path_platform(path, uniform) do
    wide = Enum.filter(path, fn p -> p.w >= 100 end)

    case wide do
      [] -> nil
      list -> Enum.at(list, Seed.rand_int(uniform, 0, length(list) - 1))
    end
  end

  defp pendulum_gate(uniform, chunk, effect) do
    path = path_platforms(chunk.platforms)

    case path do
      [] ->
        :skip

      list ->
        plat = Enum.at(list, Seed.rand_int(uniform, 0, min(length(list) - 1, 3)))

        prop = %{
          id: "item-gate-pendulum-#{chunk.index}",
          kind: "pendulum",
          x: plat.x + div(plat.w, 2) - 20,
          y: plat.y - 90,
          w: 40,
          h: 40
        }

        {:ok, tagged(chunk, props: (chunk.props || []) ++ [prop], suggested_effect: effect)}
    end
  end

  defp mover_gate(uniform, chunk) do
    path = path_platforms(chunk.platforms)

    case path do
      [] ->
        :skip

      list ->
        plat = Enum.at(list, Seed.rand_int(uniform, 0, min(length(list) - 1, 2)))

        updated =
          Enum.map(chunk.platforms, fn p ->
            if p.id == plat.id do
              %{p | kind: "mover", id: "#{plat.id}-mover"}
            else
              p
            end
          end)

        {:ok, tagged(chunk, platforms: updated, suggested_effect: "pin_platform")}
    end
  end

  defp clamp(v, min, max), do: v |> max(min) |> min(max)

  defp tagged(chunk, attrs) do
    Enum.reduce(attrs, chunk, fn {key, val}, acc -> Map.put(acc, key, val) end)
  end
end
