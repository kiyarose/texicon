defmodule Texicon.Game.WallLayout do
  @moduledoc false

  alias Texicon.Game.{Difficulty, Seed}

  @wall_w 16
  @short_h 88
  @tall_min 210
  @tall_max 300

  @tall_wall_effects [
    "deploy_spring",
    "push_block",
    "box_gun",
    "grapple_line",
    "gravity_well",
    "bomb_platform",
    "flip_gravity"
  ]

  @doc """
  Interior vertical barriers on platforms — short (jumpable) or tall (needs tools).
  """
  def interior_walls(uniform, platforms, entry_y, exit_y, chunk_index, loadout_effects \\ []) do
    tier = Difficulty.tier(chunk_index)
    can_tall? = can_place_tall?(loadout_effects)
    count = min(3, 1 + div(tier, 4))

    {path_plats, other_plats} =
      Enum.split_with(platforms, fn p ->
        id = to_string(Map.get(p, :id) || "")
        String.starts_with?(id, "path-")
      end)

    barriers =
      if tier >= 4 and path_plats != [] do
        case path_barrier(uniform, path_plats, entry_y, exit_y, chunk_index, can_tall?) do
          nil -> []
          wall -> [wall]
        end
      else
        []
      end

    extra =
      Enum.reduce(1..max(0, count - length(barriers)), barriers, fn _, acc ->
        case scatter_barrier(uniform, other_plats, entry_y, exit_y, acc, chunk_index, can_tall?) do
          nil -> acc
          wall -> acc ++ [wall]
        end
      end)

    extra
  end

  defp can_place_tall?(effects) do
    effects = Enum.map(effects, &to_string/1)
    Enum.any?(@tall_wall_effects, &(&1 in effects))
  end

  defp path_barrier(uniform, path_plats, entry_y, exit_y, chunk_index, can_tall?) do
    mid =
      path_plats
      |> Enum.filter(fn p -> p.y < entry_y - 100 and p.y > exit_y + 100 end)
      |> Enum.sort_by(& &1.y, :desc)

    case mid do
      [] ->
        nil

      plats ->
        plat = Enum.at(plats, min(length(plats) - 1, Seed.rand_int(uniform, 0, length(plats) - 1)))

        tall? =
          can_tall? and
            (Seed.rand_int(uniform, 0, 100) > 35 or Difficulty.tier(chunk_index) > 10)

        x = placement_x(uniform, plat)
        make_barrier(x, plat.y, tall?, "path-barrier")
    end
  end

  defp scatter_barrier(uniform, platforms, entry_y, exit_y, existing, _chunk_index, can_tall?) do
    eligible =
      platforms
      |> Enum.filter(fn p ->
        kind = Map.get(p, :kind) || "solid"
        kind in ["solid", "bouncy", "mover", "ice", "crumble"] and
          p.y < entry_y - 80 and p.y > exit_y + 80 and p.w >= 72 and
          not overlaps_existing?(p, existing)
      end)

    case eligible do
      [] ->
        nil

      plats ->
        plat = Enum.at(plats, Seed.rand_int(uniform, 0, length(plats) - 1))
        tall? = can_tall? and Seed.rand_int(uniform, 0, 100) > 50
        x = placement_x(uniform, plat)
        make_barrier(x, plat.y, tall?, "scatter-barrier")
    end
  end

  defp overlaps_existing?(plat, existing) do
    Enum.any?(existing, fn wall ->
      abs(wall.x - (plat.x + div(plat.w, 2))) < 48 and abs(wall.y + wall.h - plat.y) < 20
    end)
  end

  defp placement_x(uniform, plat) do
    margin = 28
    min_x = plat.x + margin
    max_x = plat.x + plat.w - @wall_w - margin

    if max_x <= min_x do
      plat.x + div(plat.w, 2) - div(@wall_w, 2)
    else
      Seed.rand_int(uniform, min_x, max_x)
    end
  end

  defp make_barrier(x, floor_y, tall?, prefix) do
    h =
      if tall? do
        @tall_min + rem(abs(floor_y), @tall_max - @tall_min)
      else
        @short_h
      end

    %{
      x: x,
      y: floor_y - h,
      w: @wall_w,
      h: h,
      kind: "wall",
      id: "#{prefix}-#{x}-#{floor_y}"
    }
  end
end
