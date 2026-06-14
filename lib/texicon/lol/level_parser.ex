defmodule Texicon.Lol.LevelParser do
  @moduledoc false

  alias Texicon.Lol.Generated

  @prop_kinds ~w(spring crate bomb pendulum)

  @meta_keys %{
    "entry_y" => ~r/^entry[\s_]*y$/i,
    "exit_y" => ~r/^exit[\s_]*y$/i,
    "item" => ~r/^item$/i,
    "music_bpm" => ~r/^music[\s_]*bpm$/i,
    "needs_item" => ~r/^needs[\s_]*item$/i,
    "spawn_row" => ~r/^spawn[\s_]*row$/i
  }

  def parse_file(root, rel_path) do
    source = root |> Path.join(rel_path) |> File.read!()
    meta = parse_meta(source)
    grid_lines = extract_grid(source)
    rasterize(grid_lines, meta)
  end

  def parse_meta(source) do
    without_grid = Regex.replace(~r/OBTW[\s\S]*?TLDR/i, source, "")

    without_grid
    |> String.split("\n")
    |> Enum.reduce(%{}, fn line, acc ->
      trimmed = String.trim(line)

      case Regex.run(~r/I\s+HAS\s+A\s+(.+?)\s+ITZ\s+"([^"]*)"/i, trimmed) do
        [_, key_raw, str_val] ->
          key = normalize_meta_key(key_raw)
          if key, do: Map.put(acc, key, str_val), else: acc

        _ ->
          case Regex.run(~r/I\s+HAS\s+A\s+(.+?)\s+ITZ\s+(-?\d+\.?\d*)\s*$/i, trimmed) do
            [_, key_raw, num_val] ->
              key = normalize_meta_key(key_raw)
              val = parse_num(num_val)
              if key, do: Map.put(acc, key, val), else: acc

            _ ->
              acc
          end
      end
    end)
  end

  def extract_grid(source) do
    case Regex.run(~r/OBTW\s*\n([\s\S]*?)\nTLDR/i, source) do
      [_, body] ->
        body
        |> String.split("\n")
        |> Enum.map(&String.trim/1)
        |> Enum.reject(&(&1 == ""))

      _ ->
        []
    end
  end

  def rasterize(grid_lines, meta) do
    cfg = Generated.level_config()
    cell = cfg[:cell_size] || 10
    platform_h = cfg[:platform_h] || 14
    prop_size = cfg[:prop_size] || 28
    world_w = Generated.game_config()[:world_width] || 960
    cols = div(world_w, cell)
    char_to_kind = build_char_map()

    {platforms, walls, props} =
      Enum.reduce(Enum.with_index(grid_lines), {[], [], []}, fn {row, y_idx}, acc ->
        row = normalize_row(row, cols)
        y = y_idx * cell
        scan_row(row, y, cell, platform_h, prop_size, char_to_kind, acc)
      end)

    entry_y =
      case meta["spawn_row"] do
        n when is_number(n) -> n * cell
        _ -> meta["entry_y"]
      end

    %{
      "meta" => Map.put(meta, "entry_y", entry_y || meta["entry_y"]),
      "platforms" => platforms,
      "walls" => walls,
      "props" => props
    }
  end

  defp build_char_map do
    Generated.level_chars()
    |> Enum.reduce(%{}, fn {kind, char}, acc ->
      Map.put(acc, char, kind)
    end)
    |> Map.put("|", "wall")
    |> Map.put("#", "solid")
    |> Map.put("=", "solid")
  end

  defp normalize_row(row, cols) do
    row = String.replace(row, " ", ".")

    cond do
      String.length(row) < cols -> row <> String.duplicate(".", cols - String.length(row))
      String.length(row) > cols -> String.slice(row, 0, cols)
      true -> row
    end
  end

  defp scan_row(row, y, cell, platform_h, prop_size, char_to_kind, {plats, walls, props}) do
    chars = String.graphemes(row)
    len = length(chars)

    {plats, walls, props, span} =
      Enum.reduce(0..(len - 1), {plats, walls, props, nil}, fn idx, {p, w, pr, span} ->
        char = Enum.at(chars, idx)
        kind = Map.get(char_to_kind, char)

        cond do
          kind in @prop_kinds ->
            {p2, w2, pr2, _} = flush(p, w, pr, span, y, cell, platform_h)
            prop = %{
              "id" => "prop-#{y}-#{idx}",
              "kind" => kind,
              "x" => idx * cell,
              "y" => y,
              "w" => prop_size,
              "h" => prop_size
            }

            {p2, w2, pr2 ++ [prop], nil}

          kind == "wall" or char == "|" ->
            if span && span.kind == "wall" && span.end + 1 == idx do
              {p, w, pr, %{span | end: idx}}
            else
              {p2, w2, pr2, _} = flush(p, w, pr, span, y, cell, platform_h)
              {p2, w2, pr2, %{kind: "wall", start: idx, end: idx}}
            end

          kind && kind not in @prop_kinds ->
            if span && span.kind == kind && span.end + 1 == idx do
              {p, w, pr, %{span | end: idx}}
            else
              {p2, w2, pr2, _} = flush(p, w, pr, span, y, cell, platform_h)
              {p2, w2, pr2, %{kind: kind, start: idx, end: idx}}
            end

          true ->
            flush(p, w, pr, span, y, cell, platform_h) |> then(fn {p2, w2, pr2, _} -> {p2, w2, pr2, nil} end)
        end
      end)

    {p, w, pr, _} = flush(plats, walls, props, span, y, cell, platform_h)
    {p, w, pr}
  end

  defp flush(p, w, pr, nil, _y, _cell, _h), do: {p, w, pr, nil}

  defp flush(p, w, pr, span, y, cell, platform_h) do
    x = span.start * cell
    width = (span.end - span.start + 1) * cell
    rect = %{"x" => x, "y" => y, "w" => width, "h" => platform_h}

    if span.kind == "wall" do
      {p, w ++ [Map.put(rect, "kind", "wall")], pr, nil}
    else
      {p ++ [Map.put(rect, "kind", span.kind)], w, pr, nil}
    end
  end

  defp normalize_meta_key(raw) do
    key = raw |> String.trim() |> String.replace(~r/\s+/, "_") |> String.downcase()

    Enum.find_value(@meta_keys, fn {canonical, pattern} ->
      if Regex.match?(pattern, key), do: canonical
    end)
  end

  defp parse_num(raw) do
    if String.contains?(raw, "."), do: String.to_float(raw), else: String.to_integer(raw)
  end
end
