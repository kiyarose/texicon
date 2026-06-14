defmodule Texicon.Tex.Registry do
  @moduledoc """
  Runtime access to compiled `.tex` registry data.
  """

  alias Texicon.Game.Solvability
  alias Texicon.Game.ChunkPlatforms

  alias Texicon.Lol.Generated

  @world_width 960

  defp chunk_height, do: Generated.game_config()[:chunk_height]

  def load! do
    path = registry_path()

    unless File.exists?(path) do
      raise "Registry not found at #{path}. Run `mix texicon.tex` first."
    end

    path
    |> File.read!()
    |> Jason.decode!()
  end

  def cached do
    case :persistent_term.get({__MODULE__, :registry}, nil) do
      nil ->
        data = load!()
        :persistent_term.put({__MODULE__, :registry}, data)
        data

      data ->
        data
    end
  end

  def reload! do
    :persistent_term.erase({__MODULE__, :registry})
    cached()
  end

  def items do
    cached()["items"] || []
  end

  def blocks do
    cached()["blocks"] || []
  end

  def block_colors do
    blocks()
    |> Map.new(fn b -> {b["kind"], b["color"]} end)
  end

  def milestones, do: cached()["milestones"] || []
  def templates, do: cached()["templates"] || []
  def levels, do: cached()["levels"] || %{}

  @doc """
  Returns `{:ok, level_id}` for milestone chunks or `:procedural`.
  Exact milestones take priority over every-N rules.
  """
  def milestone_level(chunk_index) when is_integer(chunk_index) and chunk_index >= 0 do
    exact =
      milestones()
      |> Enum.find(fn m -> m["type"] == "exact" and m["index"] == chunk_index end)

    if exact do
      {:ok, exact["level"]}
    else
      every =
        milestones()
        |> Enum.filter(fn m -> m["type"] == "every" end)
        |> Enum.find(fn m -> m["n"] > 0 and rem(chunk_index, m["n"]) == 0 end)

      case every do
        %{"level" => level} -> {:ok, level}
        _ -> :procedural
      end
    end
  end

  def level(level_id) do
    Map.fetch!(levels(), level_id)
  end

  def item_by_id(id) do
    Enum.find(items(), fn item -> item["id"] == id end)
  end

  @doc """
  Build a runtime chunk map from a `.tex` level definition.
  """
  def build_chunk(level_id, chunk_index, _run_seed) do
    level = level(level_id)
    meta = level["meta"] || %{}

    {platforms, entry_y} =
      ChunkPlatforms.prepare_chunk(level["platforms"] || [], meta["entry_y"])

    walls = level["walls"] || []

    default_bg = %{
      "chunk_index" => chunk_index,
      "colors" => ["hsl(240, 55%, 18%)", "hsl(260, 50%, 28%)", "hsl(280, 45%, 38%)"],
      "shapes" => []
    }

    bpm = meta["music_bpm"] || 110

    chunk = %{
      index: chunk_index,
      width: @world_width,
      height: chunk_height(),
      entry_y: entry_y,
      exit_y: meta["exit_y"] || 60,
      chunk_type: "milestone",
      platforms: atomize_list(platforms),
      walls: atomize_list(walls),
      props: atomize_list(level["props"] || []),
      bg: default_bg,
      music: %{
        bpm: bpm,
        kick: "x...x...x...x...",
        snare: "....x.......x...",
        bass: "x.x.....x.x.....",
        melody: "..x.....x.....x."
      },
      item: nil,
      source: level_id,
      milestone: true
    }

    unless Solvability.valid?(chunk) do
      Mix.shell().error("Warning: milestone level #{level_id} may be difficult to solvability-check")
    end

    chunk
  end

  defp registry_path do
    Application.app_dir(:texicon, "priv/texicon/registry.json")
  end

  defp atomize_list(list) do
    Enum.map(list, &atomize_map/1)
  end

  defp atomize_map(map) when is_map(map) do
    map
    |> Map.new(fn {k, v} -> {String.to_existing_atom(k), normalize_value(v)} end)
  rescue
    ArgumentError ->
      Map.new(map, fn {k, v} -> {String.to_atom(k), normalize_value(v)} end)
  end

  defp normalize_value(false), do: false
  defp normalize_value("true"), do: true
  defp normalize_value("false"), do: false
  defp normalize_value(v), do: v
end
