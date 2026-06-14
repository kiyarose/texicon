defmodule Texicon.Game.ChunkGenerator do
  @moduledoc """
  Procedurally generates screen-height chunks from a run seed.
  """

  alias Texicon.Game.{
    ChunkPlatforms,
    ChunkTemplates,
    Difficulty,
    Inventory,
    ItemGate,
    PlatformLayout,
    PuzzleLayout,
    Seed,
    Solvability,
    WallLayout
  }

  alias Texicon.Lol.Generated

  @world_width 960
  @max_attempts 5

  defp chunk_height, do: Generated.game_config()[:chunk_height]

  def generate(run_seed, chunk_index, opts \\ []) do
    loadout_effects = Keyword.get(opts, :loadout_effects, [])

    chunk =
      case Texicon.Tex.Registry.milestone_level(chunk_index) do
        {:ok, level_id} ->
          Texicon.Tex.Registry.build_chunk(level_id, chunk_index, run_seed)

        :procedural ->
          if PuzzleLayout.puzzle?(chunk_index) do
            build_puzzle_chunk(run_seed, chunk_index)
          else
            case build_template_chunk(run_seed, chunk_index, loadout_effects) do
              {:ok, chunk} -> chunk
              :random -> do_generate(run_seed, chunk_index, 0, Keyword.get(opts, :relax, 0), loadout_effects)
            end
          end
      end

    attach_loadout_roll(chunk, run_seed, chunk_index)
  end

  defp build_template_chunk(run_seed, chunk_index, loadout_effects) do
    case ChunkTemplates.pick(run_seed, chunk_index, loadout_effects) do
      :random ->
        :random

      {:template, level_id} ->
        chunk = template_chunk(level_id, run_seed, chunk_index)

        if Solvability.valid?(chunk, loadout_effects: loadout_effects) do
          {:ok, chunk}
        else
          :random
        end
    end
  end

  defp template_chunk(level_id, _run_seed, chunk_index) do
    level = Texicon.Tex.Registry.level(level_id)
    meta = level["meta"] || %{}
    height = chunk_height()

    {platforms, entry_y} =
      ChunkPlatforms.prepare_chunk(
        (level["platforms"] || []) ++ template_path(meta["entry_y"] || height - 48, meta["exit_y"] || 60),
        meta["entry_y"]
      )

    side_walls = [
      %{x: 0, y: 0, w: 16, h: height, kind: "wall"},
      %{x: @world_width - 16, y: 0, w: 16, h: height, kind: "wall"}
    ]

    %{
      index: chunk_index,
      width: @world_width,
      height: height,
      entry_y: entry_y,
      exit_y: meta["exit_y"] || 60,
      chunk_type: "template",
      template: level_id,
      platforms: atomize_list(platforms),
      walls: side_walls,
      props: atomize_list(level["props"] || []),
      bg: background_stub(chunk_index),
      music: music_stub(),
      item: nil
    }
  end

  defp atomize_list(list), do: Enum.map(list, &platform_to_atoms/1)

  defp build_puzzle_chunk(run_seed, chunk_index) do
    puzzle = PuzzleLayout.build(run_seed, chunk_index)

    Map.merge(puzzle, %{
      bg: background_stub(chunk_index),
      music: music_stub(),
      item: nil
    })
  end

  defp attach_loadout_roll(chunk, run_seed, chunk_index) do
    if Inventory.reroll?(chunk_index) do
      roll =
        Inventory.reroll_loadout(run_seed, chunk_index,
          required_effect: Map.get(chunk, :required_effect)
        )

      Map.put(chunk, :loadout_roll, roll)
    else
      chunk
    end
  end

  defp do_generate(run_seed, chunk_index, attempt, relax, loadout_effects)
       when attempt >= @max_attempts do
    build_chunk(run_seed, chunk_index, {:retry, chunk_index, 99}, relax + 2, loadout_effects, attempt)
  end

  defp do_generate(run_seed, chunk_index, attempt, relax, loadout_effects) when attempt < @max_attempts do
    purpose =
      if attempt == 0,
        do: :terrain,
        else: {:retry, chunk_index, attempt}

    chunk = build_chunk(run_seed, chunk_index, purpose, relax, loadout_effects, attempt)

    if accept_chunk?(chunk, loadout_effects, attempt, chunk_index) do
      chunk
    else
      do_generate(run_seed, chunk_index, attempt + 1, relax + 1, loadout_effects)
    end
  end

  defp accept_chunk?(chunk, loadout_effects, attempt, chunk_index) do
    Solvability.valid?(chunk, loadout_effects: loadout_effects) and
      soft_accept_chunk?(chunk, loadout_effects, attempt, chunk_index)
  end

  defp soft_accept_chunk?(chunk, loadout_effects, attempt, chunk_index) do
    active = ItemGate.active_effects(loadout_effects)

    cond do
      active == [] ->
        true

      chunk_index < 2 ->
        true

      attempt >= @max_attempts - 1 ->
        true

      Map.get(chunk, :item_gate) != nil ->
        true

      Solvability.benefits_from_items?(chunk, loadout_effects) ->
        true

      attempt >= 2 ->
        true

      true ->
        false
    end
  end

  defp template_path(entry_y, exit_y) do
    steps = 7

    for i <- 1..steps do
      t = i / (steps + 1)
      py =
        if i == steps do
          exit_y + 36
        else
          round(entry_y - 50 - t * (entry_y - 50 - exit_y - 60))
        end

      px = 320 + round(:math.sin(t * :math.pi()) * 120)

      %{
        "x" => px,
        "y" => py,
        "w" => 110,
        "h" => 14,
        "kind" => "solid",
        "id" => "tpl-path-#{i}"
      }
    end
  end

  defp build_chunk(run_seed, chunk_index, purpose, relax, loadout_effects, attempt) do
    height = chunk_height()
    platform_count = Difficulty.scattered_count(7, chunk_index, relax)

    chunk =
      Seed.with_rng(run_seed, chunk_index, purpose, fn uniform ->
        exit_x = Seed.rand_int(uniform, 320, @world_width - 320)
        exit_y = Seed.rand_int(uniform, 40, 80)
        entry_y = height - 48

        side_walls = [
          %{x: 0, y: 0, w: 16, h: height, kind: "wall"},
          %{x: @world_width - 16, y: 0, w: 16, h: height, kind: "wall"}
        ]

        path = guaranteed_path(uniform, exit_x, exit_y, height, chunk_index)
        path_atoms = Enum.map(path, &platform_to_atoms/1)

        scattered =
          Enum.reduce(1..platform_count, [], fn i, acc ->
            case PlatformLayout.try_scattered(
                   uniform,
                   entry_y,
                   exit_y,
                   acc,
                   chunk_index,
                   i,
                   relax,
                   0
                 ) do
              nil -> acc
              plat -> acc ++ [platform_to_atoms(plat)]
            end
          end)

        all_platforms_raw = path_atoms ++ scattered
        {prepared, resolved_entry} = ChunkPlatforms.prepare_chunk(all_platforms_raw, entry_y)
        prepared_atoms = Enum.map(prepared, &platform_to_atoms/1)
        all_platforms = PlatformLayout.finalize(prepared_atoms, exit_y, chunk_index)

        interior =
          WallLayout.interior_walls(
            uniform,
            all_platforms,
            resolved_entry,
            exit_y,
            chunk_index,
            loadout_effects
          )

        base = %{
          index: chunk_index,
          width: @world_width,
          height: height,
          entry_y: resolved_entry,
          exit_y: exit_y,
          chunk_type: "normal",
          platforms: all_platforms,
          walls: side_walls ++ interior,
          props: [],
          bg: background(uniform, chunk_index),
          music: music_patterns(uniform),
          item: nil
        }

        force_gate? =
          attempt == 0 and chunk_index >= 3 and ItemGate.active_effects(loadout_effects) != []

        {chunk, _gate} =
          ItemGate.apply(uniform, base, loadout_effects, chunk_index, force: force_gate?)

        chunk
      end)

    chunk
  end

  defp guaranteed_path(_uniform, exit_x, exit_y, height, chunk_index) do
    steps = Difficulty.path_steps(chunk_index)
    stretch = Difficulty.path_vertical_stretch(chunk_index)
    sway_amp = Difficulty.path_sway(chunk_index)

    for i <- 1..steps do
      t = i / (steps + 1)
      base_py =
        if i == steps do
          exit_y + 36
        else
          height - 60 - t * (height - 60 - exit_y - 60)
        end

      prev_t = max(0, (i - 1) / (steps + 1))

      prev_py =
        if i == 1 do
          height - 60
        else
          height - 60 - prev_t * (height - 60 - exit_y - 60)
        end

      extra_drop = round((prev_py - base_py) * (stretch - 1.0))
      py = round(base_py - extra_drop)

      sway = round(:math.sin(t * :math.pi()) * sway_amp)
      px = clamp(exit_x + sway - 60, 40, @world_width - 200)

      %{
        x: px,
        y: py,
        w: max(90, 120 - div(Difficulty.tier(chunk_index), 2)),
        h: 14,
        kind: "solid",
        id: "path-#{i}"
      }
    end
  end

  defp clamp(v, min, max), do: v |> max(min) |> min(max)

  defp platform_to_atoms(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_atom(k), v}
      {k, v} -> {k, v}
    end)
  end

  defp background(uniform, chunk_index) do
    hue1 = Seed.rand_int(uniform, 0, 360)
    hue2 = rem(hue1 + Seed.rand_int(uniform, 40, 120), 360)
    hue3 = rem(hue2 + Seed.rand_int(uniform, 40, 100), 360)
    shape_count = Seed.rand_int(uniform, 5, 12)
    shape_kinds = ["circle", "rect", "triangle"]

    shapes =
      for i <- 1..shape_count do
        %{
          kind: Enum.at(shape_kinds, Seed.rand_int(uniform, 0, 2)),
          x: Seed.rand_float(uniform, 0, 1),
          y: Seed.rand_float(uniform, 0, 1),
          size: Seed.rand_float(uniform, 0.04, 0.18),
          hue: rem(hue1 + i * 17, 360),
          drift_x: Seed.rand_float(uniform, 0.2, 1.2),
          drift_y: Seed.rand_float(uniform, 0.1, 0.8),
          phase: Seed.rand_float(uniform, 0, 6.28)
        }
      end

    %{
      chunk_index: chunk_index,
      colors: [
        "hsl(#{hue1}, 55%, 18%)",
        "hsl(#{hue2}, 50%, 28%)",
        "hsl(#{hue3}, 45%, 38%)"
      ],
      shapes: shapes
    }
  end

  defp background_stub(chunk_index) do
    %{
      chunk_index: chunk_index,
      colors: ["hsl(280, 55%, 18%)", "hsl(300, 50%, 28%)", "hsl(320, 45%, 38%)"],
      shapes: []
    }
  end

  defp music_patterns(uniform) do
    steps = 16

    kick =
      for _ <- 1..steps do
        if uniform.() < 0.35, do: "x", else: "."
      end

    snare =
      for i <- 1..steps do
        if rem(i, 4) == 0 and uniform.() < 0.7, do: "x", else: "."
      end

    bass =
      for _ <- 1..steps do
        if uniform.() < 0.25, do: "x", else: "."
      end

    melody =
      for _ <- 1..steps do
        if uniform.() < 0.2, do: "x", else: "."
      end

    %{
      bpm: Seed.rand_int(uniform, 90, 130),
      kick: Enum.join(kick),
      snare: Enum.join(snare),
      bass: Enum.join(bass),
      melody: Enum.join(melody)
    }
  end

  defp music_stub do
    %{
      bpm: 100,
      kick: "x...x...x...x...",
      snare: "....x.......x...",
      bass: "x.x.....x.x.....",
      melody: "..x.....x.....x."
    }
  end

  def test_chunk do
    height = chunk_height()
    entry_y = height - 48

    platforms =
      ChunkPlatforms.prepare(
        [
          %{x: 400, y: 480, w: 120, h: 14, kind: "solid"},
          %{x: 250, y: 390, w: 120, h: 14, kind: "solid"},
          %{x: 500, y: 300, w: 120, h: 14, kind: "solid"},
          %{x: 350, y: 210, w: 120, h: 14, kind: "solid"},
          %{x: 420, y: 130, w: 120, h: 14, kind: "solid"}
        ],
        entry_y
      )
      |> Enum.map(&platform_to_atoms/1)

    %{
      index: 0,
      width: @world_width,
      height: height,
      entry_y: entry_y,
      exit_y: 60,
      chunk_type: "normal",
      platforms: platforms,
      walls: [
        %{x: 0, y: 0, w: 16, h: height, kind: "wall"},
        %{x: @world_width - 16, y: 0, w: 16, h: height, kind: "wall"}
      ],
      props: [],
      bg: %{
        chunk_index: 0,
        colors: ["hsl(240, 55%, 18%)", "hsl(260, 50%, 28%)", "hsl(280, 45%, 38%)"],
        shapes: []
      },
      music: music_stub(),
      item: %{
        id: "double_jump",
        name: "Double Jump",
        uses: 3,
        effect: "extra_jump",
        description: "Extra air jump",
        passive: true
      }
    }
  end
end
