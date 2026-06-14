defmodule Texicon.Tex.ParserTest do
  use ExUnit.Case, async: true

  alias Texicon.Tex.Parser

  @root Path.expand("..", File.cwd!())

  test "parses system.tex into items, blocks, milestones, levels" do
    registry = Parser.parse_system(@root)

    assert registry["version"] == 1
    assert length(registry["items"]) == 11
    assert length(registry["blocks"]) >= 12
    assert Enum.any?(registry["milestones"], fn m -> m["type"] == "exact" and m["index"] == 0 end)
    assert Map.has_key?(registry["levels"], "levels/start.lol")
  end

  test "parses level geometry" do
    level = Parser.parse_level_file(@root, "levels/start.lol")

    assert level["meta"]["entry_y"] == 580
    assert length(level["platforms"]) >= 5
    assert length(level["walls"]) >= 2
  end
end
