defmodule Texicon.Tex.Parser do
  @moduledoc """
  Parses LaTeX-style Texicon `.tex` files into a registry map.
  """

  @doc """
  Parse `system.tex` at `root` and return a registry map.
  """
  def parse_system(root) do
    path = Path.join(root, "system.tex")

    unless File.exists?(path) do
      raise "system.tex not found at #{path}"
    end

    lines = path |> expand_file(root, MapSet.new()) |> List.flatten()

    state =
      lines
      |> Enum.reduce(empty_state(), &apply_manifest_line(&2, &1))

    level_paths =
      (state.milestones ++ state.templates)
      |> Enum.map(& &1["level"])
      |> Enum.uniq()

    levels =
      Enum.reduce(level_paths, %{}, fn rel, acc ->
        Map.put(acc, rel, parse_level_file(root, rel))
      end)

    %{
      "version" => state.version,
      "items" => state.items,
      "blocks" => state.blocks,
      "props" => state[:props] || [],
      "milestones" => state.milestones,
      "templates" => state.templates,
      "levels" => levels
    }
  end

  defp empty_state do
    %{version: 1, items: [], blocks: [], props: [], milestones: [], templates: []}
  end

  @doc false
  def parse_level_file(root, rel_path) do
    if String.ends_with?(rel_path, ".lol") do
      Texicon.Lol.LevelParser.parse_file(root, rel_path)
    else
      parse_level_tex(root, rel_path)
    end
  end

  defp parse_level_tex(root, rel_path) do
    path = Path.join(root, rel_path)

    unless File.exists?(path) do
      raise "Level file not found: #{path}"
    end

    state = %{meta: %{}, platforms: [], props: [], walls: []}

    path
    |> File.read!()
    |> strip_comments()
    |> split_lines()
    |> Enum.reduce(state, &apply_level_line(&2, &1))
    |> then(fn s ->
      %{
        "meta" => stringify_keys(s.meta),
        "platforms" => Enum.map(s.platforms, &stringify_keys/1),
        "props" => Enum.map(s.props, &stringify_keys/1),
        "walls" => Enum.map(s.walls, &stringify_keys/1)
      }
    end)
  end

  defp expand_file(path, root, visited) do
    abs = if Path.type(path) == :relative, do: Path.join(root, path), else: Path.expand(path)

    if MapSet.member?(visited, abs) do
      []
    else
      visited = MapSet.put(visited, abs)

      abs
      |> File.read!()
      |> strip_comments()
      |> split_lines()
      |> Enum.flat_map(fn line ->
        case Regex.run(~r/\\input\{([^}]+)\}/, line) do
          [_, rel] -> expand_file(rel, root, visited)
          _ -> [line]
        end
      end)
    end
  end

  defp strip_comments(text) do
    text
    |> String.split("\n")
    |> Enum.map(fn line ->
      case String.split(line, "%", parts: 2) do
        [content, _] -> content
        [content] -> content
      end
    end)
    |> Enum.join("\n")
  end

  defp split_lines(text) do
    text
    |> String.split("\n")
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp apply_manifest_line(state, line) do
    cond do
      match = Regex.run(~r/\\TexiconVersion\{(\d+)\}/, line) ->
        [_, v] = match
        %{state | version: String.to_integer(v)}

      match = Regex.run(~r/\\ItemDef\{([^}]+)\}\{([^}]+)\}\{(\d+)\}\{([^}]+)\}\{([^}]+)\}(?:\{([^}]+)\})?/, line) ->
        [_, id, name, uses, effect, desc | rest] = match
        passive_flag = List.first(rest)

        item = %{
          "id" => id,
          "name" => name,
          "uses" => String.to_integer(uses),
          "effect" => effect,
          "behaviors" => parse_behaviors(effect),
          "description" => desc,
          "passive" => passive_flag in ["true", "passive", "1"]
        }

        %{state | items: state.items ++ [item]}

      match = Regex.run(~r/\\BlockDef\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}(?:\{([^}]+)\})?/, line) ->
        [_, id, kind, color | rest] = match
        behavior_field = List.first(rest) || kind

        block = %{
          "id" => id,
          "kind" => kind,
          "color" => normalize_color(color),
          "behavior" => behavior_field,
          "behaviors" => parse_behaviors(behavior_field)
        }

        %{state | blocks: state.blocks ++ [block]}

      match = Regex.run(~r/\\PropDef\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}\{([^}]+)\}(?:\{([^}]+)\})?/, line) ->
        [_, id, kind, char, color | rest] = match
        behavior_field = List.first(rest) || kind

        prop = %{
          "id" => id,
          "kind" => kind,
          "char" => char,
          "color" => normalize_color(color),
          "behaviors" => parse_behaviors(behavior_field)
        }

        %{state | props: (state[:props] || []) ++ [prop]}

      match = Regex.run(~r/\\MilestoneLevel\{(\d+)\}\{([^}]+)\}/, line) ->
        [_, index, level] = match
        milestone = %{"type" => "exact", "index" => String.to_integer(index), "level" => level}
        %{state | milestones: state.milestones ++ [milestone]}

      match = Regex.run(~r/\\MilestoneEvery\{(\d+)\}\{([^}]+)\}/, line) ->
        [_, n, level] = match
        milestone = %{"type" => "every", "n" => String.to_integer(n), "level" => level}
        %{state | milestones: state.milestones ++ [milestone]}

      match = Regex.run(~r/\\Template\{([^}]+)\}\{([^}]+)\}\{(\d+)\}(?:\{([^}]*)\})?(?:\{(\d+)\})?/, line) ->
        [_, level, tag, weight, needs_item, difficulty | _] = match

        template = %{
          "level" => level,
          "tag" => tag,
          "weight" => String.to_integer(weight),
          "needs_item" => if(needs_item in [nil, ""], do: nil, else: needs_item),
          "difficulty" => if(difficulty, do: String.to_integer(difficulty), else: 1)
        }

        %{state | templates: state.templates ++ [template]}

      true ->
        state
    end
  end

  defp apply_level_line(state, line) do
    cond do
      match = Regex.run(~r/\\LevelMeta\{(\d+)\}\{(\d+)\}\{([^}]+)\}\{(\d+)\}/, line) ->
        [_, entry_y, exit_y, item, bpm] = match

        meta = %{
          entry_y: String.to_integer(entry_y),
          exit_y: String.to_integer(exit_y),
          item: item,
          music_bpm: String.to_integer(bpm)
        }

        %{state | meta: meta}

      match = Regex.run(~r/\\Platform\{(\d+)\}\{(\d+)\}\{(\d+)\}\{(\d+)\}\{([^}]+)\}/, line) ->
        [_, x, y, w, h, kind] = match

        plat = %{
          x: String.to_integer(x),
          y: String.to_integer(y),
          w: String.to_integer(w),
          h: String.to_integer(h),
          kind: kind
        }

        %{state | platforms: state.platforms ++ [plat]}

      match = Regex.run(~r/\\Prop\{([^}]+)\}\{([^}]+)\}\{(\d+)\}\{(\d+)\}\{(\d+)\}\{(\d+)\}/, line) ->
        [_, id, kind, x, y, w, h] = match

        prop = %{
          id: id,
          kind: kind,
          x: String.to_integer(x),
          y: String.to_integer(y),
          w: String.to_integer(w),
          h: String.to_integer(h)
        }

        %{state | props: state.props ++ [prop]}

      match = Regex.run(~r/\\Wall\{(\d+)\}\{(\d+)\}\{(\d+)\}\{(\d+)\}/, line) ->
        [_, x, y, w, h] = match

        wall = %{
          x: String.to_integer(x),
          y: String.to_integer(y),
          w: String.to_integer(w),
          h: String.to_integer(h),
          kind: "wall"
        }

        %{state | walls: state.walls ++ [wall]}

      true ->
        state
    end
  end

  defp stringify_keys(map) when is_map(map) do
    Map.new(map, fn {k, v} -> {to_string(k), v} end)
  end

  defp normalize_color(color) do
    color |> String.replace("\\#", "#") |> String.trim()
  end

  defp parse_behaviors(nil), do: []
  defp parse_behaviors(""), do: []

  defp parse_behaviors(field) when is_binary(field) do
    field
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end
end
