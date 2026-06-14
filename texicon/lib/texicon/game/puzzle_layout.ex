defmodule Texicon.Game.PuzzleLayout do
  @moduledoc """
  Hand-crafted puzzle chunk layouts requiring item use.
  """

  alias Texicon.Game.{ChunkPlatforms, Seed}
  alias Texicon.Lol.Generated

  @world_width 960
  @puzzle_tags ["gap", "wall", "pendulum"]

  def puzzle?(chunk_index) when chunk_index > 0, do: rem(chunk_index, 5) == 0
  def puzzle?(_), do: false

  def build(run_seed, chunk_index) do
    height = Generated.game_config()[:chunk_height]
    entry_y = height - 48
    exit_y = 55

    Seed.with_rng(run_seed, chunk_index, :puzzle, fn uniform ->
      tag = Enum.at(@puzzle_tags, rem(chunk_index, length(@puzzle_tags)))
      {platforms, props, required_effect} = layout_for(tag, entry_y, exit_y, chunk_index, uniform)

      {prepared, resolved_entry} = ChunkPlatforms.prepare_chunk(platforms, entry_y)

      platforms = Enum.map(prepared, &platform_to_atoms/1)

      side_walls = [
        %{x: 0, y: 0, w: 16, h: height, kind: "wall"},
        %{x: @world_width - 16, y: 0, w: 16, h: height, kind: "wall"}
      ]

      %{
        index: chunk_index,
        width: @world_width,
        height: height,
        entry_y: resolved_entry,
        exit_y: exit_y,
        chunk_type: "puzzle",
        puzzle_tag: tag,
        required_effect: required_effect,
        platforms: platforms,
        walls: side_walls,
        props: Enum.map(props, &platform_to_atoms/1)
      }
    end)
  end

  defp layout_for("gap", entry_y, exit_y, _chunk_index, _uniform) do
    platforms = [
      %{x: 200, y: entry_y - 200, w: 120, h: 14, kind: "solid", id: "puzzle-far"},
      %{x: 640, y: exit_y + 80, w: 120, h: 14, kind: "solid", id: "puzzle-near-exit"}
    ]

    {platforms, [], "grapple_line"}
  end

  defp layout_for("wall", entry_y, _exit_y, _chunk_index, _uniform) do
    blocker = %{
      x: 420,
      y: entry_y - 180,
      w: 120,
      h: 14,
      kind: "solid",
      id: "puzzle-blocker"
    }

    platforms = [
      blocker,
      %{x: 300, y: entry_y - 320, w: 360, h: 14, kind: "solid", id: "puzzle-top"}
    ]

    {platforms, [], "box_gun"}
  end

  defp layout_for("pendulum", entry_y, exit_y, chunk_index, _uniform) do
    step_specs = [
      {380, 70},
      {180, 115},
      {560, 160},
      {240, 205},
      {520, 250},
      {360, 295}
    ]

    climb =
      for {{x, drop}, i} <- Enum.with_index(step_specs) do
        %{
          x: x,
          y: entry_y - drop,
          w: 110,
          h: 14,
          kind: "solid",
          id: "puzzle-step-#{i}"
        }
      end

    top_y = exit_y + 165

    top_platforms = [
      %{x: 80, y: top_y, w: 130, h: 14, kind: "solid", id: "puzzle-top-l"},
      %{x: 415, y: top_y, w: 130, h: 14, kind: "solid", id: "puzzle-top-m"},
      %{x: 750, y: top_y, w: 130, h: 14, kind: "solid", id: "puzzle-top-r"},
      %{x: 400, y: exit_y + 40, w: 160, h: 14, kind: "solid", id: "puzzle-exit"}
    ]

    bridge = %{x: 360, y: top_y + 55, w: 120, h: 14, kind: "solid", id: "puzzle-bridge"}

    props = [
      %{
        id: "puzzle-pend-a-#{chunk_index}",
        kind: "pendulum",
        x: 250,
        y: top_y - 25,
        w: 40,
        h: 40
      },
      %{
        id: "puzzle-pend-b-#{chunk_index}",
        kind: "pendulum",
        x: 480,
        y: top_y - 25,
        w: 40,
        h: 40
      },
      %{
        id: "puzzle-pend-c-#{chunk_index}",
        kind: "pendulum",
        x: 620,
        y: top_y + 15,
        w: 40,
        h: 40
      }
    ]

    {climb ++ top_platforms ++ [bridge], props, "freeze_camera"}
  end

  defp platform_to_atoms(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_atom(k), v}
      {k, v} -> {k, v}
    end)
  end
end
