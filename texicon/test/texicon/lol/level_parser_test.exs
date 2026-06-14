defmodule Texicon.Lol.LevelParserTest do
  use ExUnit.Case, async: true

  alias Texicon.Lol.LevelParser

  @root Path.expand("..", File.cwd!())

  test "parses meta constants from level lol" do
    meta = LevelParser.parse_meta("""
    I HAS A ENTRY Y ITZ 612
    I HAS A EXIT Y ITZ 60
    I HAS A ITEM ITZ "double_jump"
    I HAS A MUSIC BPM ITZ 110
    """)

    assert meta["entry_y"] == 612
    assert meta["exit_y"] == 60
    assert meta["item"] == "double_jump"
    assert meta["music_bpm"] == 110
  end

  test "rasterizes platform spans from ASCII grid" do
    grid = [
      "|" <> String.duplicate("#", 10) <> String.duplicate(".", 84) <> "|"
    ]

    result = LevelParser.rasterize(grid, %{})

    assert length(result["platforms"]) == 1
    plat = hd(result["platforms"])
    assert plat["kind"] == "solid"
    assert plat["w"] == 100
  end

  test "spawn row meta sets entry_y from grid row" do
    grid = for _ <- 1..60, do: String.duplicate(".", 92)
    result = LevelParser.rasterize(grid, %{"spawn_row" => 58})
    assert result["meta"]["entry_y"] == 580
  end

  test "parses start.lol milestone level" do
    level = LevelParser.parse_file(@root, "levels/start.lol")

    assert level["meta"]["entry_y"] == 580
    assert length(level["platforms"]) >= 5
    assert length(level["walls"]) >= 1
  end
end
