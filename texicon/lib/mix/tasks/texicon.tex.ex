defmodule Mix.Tasks.Texicon.Tex do
  @moduledoc "Compiles LaTeX-style .tex content into priv/texicon/registry.json"
  @shortdoc "Compile Texicon .tex registry"

  use Mix.Task

  @impl true
  def run(_args) do
    root = tex_root()
    Mix.shell().info("Compiling Texicon .tex from #{root}")

    registry =
      root
      |> Texicon.Tex.Parser.parse_system()
      |> enrich_registry()

    validate_milestones!(registry)

    out = Path.join(File.cwd!(), "priv/texicon/registry.json")
    File.mkdir_p!(Path.dirname(out))
    File.write!(out, Jason.encode!(registry, pretty: true))

    Mix.shell().info("Wrote #{out}")
  end

  defp tex_root do
    Path.expand("..", File.cwd!())
  end

  defp enrich_registry(registry) do
    chars = Texicon.Lol.Generated.level_chars()
    behaviors = Texicon.Lol.Generated.behaviors() |> Jason.encode!() |> Jason.decode!()

    blocks =
      Enum.map(registry["blocks"] || [], fn block ->
        kind = block["kind"]
        char = Map.get(chars, kind) || Map.get(chars, block["id"])
        block |> Map.put("char", char) |> Map.put("behavior", List.first(block["behaviors"]) || kind)
      end)

    registry
    |> Map.put("blocks", blocks)
    |> Map.put("behaviors", behaviors)
    |> Map.put("level_chars", chars |> Jason.encode!() |> Jason.decode!())
  end

  defp validate_milestones!(registry) do
    levels = registry["levels"] || %{}
    height = Texicon.Lol.Generated.game_config()[:chunk_height]

    for milestone <- registry["milestones"] || [] do
      level_id = milestone["level"]

      unless Map.has_key?(levels, level_id) do
        Mix.raise("Milestone references missing level: #{level_id}")
      end

      level = Map.fetch!(levels, level_id)
      entry_y = get_in(level, ["meta", "entry_y"]) || height - 48

      platforms =
        (level["platforms"] || [])
        |> Texicon.Game.ChunkPlatforms.prepare(entry_y)
        |> atomize()

      chunk = %{
        index: 0,
        width: 960,
        height: height,
        entry_y: entry_y,
        exit_y: get_in(level, ["meta", "exit_y"]) || 60,
        chunk_type: "milestone",
        platforms: platforms,
        walls: atomize(level["walls"]),
        props: atomize(level["props"])
      }

      unless Texicon.Game.Solvability.valid?(chunk) do
        if milestone["type"] == "exact" and milestone["index"] == 0 do
          Mix.raise("Start level #{level_id} is not solvable")
        else
          Mix.shell().info("warning: Level #{level_id} may be difficult (solvability check failed)")
        end
      end
    end
  end

  defp atomize(list) when is_list(list) do
    Enum.map(list, fn map ->
      Map.new(map, fn {k, v} -> {String.to_atom(k), v} end)
    end)
  end

  defp atomize(_), do: []
end
