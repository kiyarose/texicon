defmodule Texicon.Game.ChunkPlatforms do
  @moduledoc false

  alias Texicon.Lol.Generated

  @world_width 960
  @bottom_zone 140

  defp chunk_height, do: Generated.game_config()[:chunk_height]

  @doc """
  Resolve entry_y from visible platforms in the bottom zone of the chunk.
  Uses the lowest (largest y) walkable platform top in the bottom band.
  """
  def resolve_entry_y(platforms, default \\ nil) do
    default = default || chunk_height() - 48
    height = chunk_height()
    threshold = height - @bottom_zone

    walkable =
      platforms
      |> List.wrap()
      |> Enum.filter(fn p ->
        kind = platform_kind(p)
        kind in ["solid", "spawn", "bouncy", "oneway", "button_spring", "ice", "crumble", "mover", "upgrav_tile", "flip_tile"]
      end)

    candidates =
      walkable
      |> Enum.filter(fn p ->
        y = platform_y(p)
        y >= threshold and y <= height
      end)

    case candidates do
      [] ->
        case walkable do
          [] -> default
          _ -> walkable |> Enum.map(&platform_y/1) |> Enum.max()
        end

      list ->
        list |> Enum.map(&platform_y/1) |> Enum.max()
    end
  end

  @doc """
  Prepare platforms for a chunk: strip full-width floors, resolve entry, inject spawn pad.
  Returns `{platforms, entry_y}`.
  """
  def prepare_chunk(platforms, entry_y \\ nil) do
    default = entry_y || chunk_height() - 48
    cleaned = platforms |> List.wrap() |> Enum.reject(&full_width_floor?/1)
    resolved = resolve_entry_y(cleaned, default)
    prepared = ensure_spawn(cleaned, resolved)
    {prepared, resolved}
  end

  def prepare(platforms, entry_y) do
    {prepared, _entry} = prepare_chunk(platforms, entry_y)
    prepared
  end

  def spawn_platform(entry_y) do
    %{
      "id" => "spawn",
      "x" => div(@world_width, 2) - 120,
      "y" => entry_y,
      "w" => 240,
      "h" => 16,
      "kind" => "spawn"
    }
  end

  defp ensure_spawn(platforms, entry_y) do
    without_old =
      Enum.reject(platforms, fn p ->
        spawn_platform?(p) or overlaps_spawn_zone?(p, entry_y)
      end)

    [spawn_platform(entry_y) | without_old]
  end

  defp overlaps_spawn_zone?(plat, entry_y) do
    y = platform_y(plat)
    abs(y - entry_y) <= 4 and platform_kind(plat) in ["solid", "spawn"]
  end

  defp spawn_platform?(%{"id" => "spawn"}), do: true
  defp spawn_platform?(%{id: "spawn"}), do: true
  defp spawn_platform?(_), do: false

  defp platform_y(%{"y" => y}), do: y
  defp platform_y(%{y: y}), do: y

  defp platform_kind(p), do: Map.get(p, :kind) || Map.get(p, "kind")

  defp full_width_floor?(%{"kind" => kind, "w" => w, "y" => y}) when kind in ["solid", "spawn"] and w >= @world_width - 32 do
    y >= chunk_height() - 32
  end

  defp full_width_floor?(%{kind: kind, w: w, y: y}) when kind in [:solid, :spawn] and w >= @world_width - 32 do
    y >= chunk_height() - 32
  end

  defp full_width_floor?(_), do: false
end
