defmodule Texicon.Game.ChunkPlatformsTest do
  use ExUnit.Case, async: true

  alias Texicon.Game.ChunkPlatforms

  test "resolve_entry_y picks lowest platform in bottom zone" do
    platforms = [
      %{"y" => 400, "kind" => "solid", "w" => 120},
      %{"y" => 580, "kind" => "solid", "w" => 120},
      %{"y" => 540, "kind" => "solid", "w" => 120}
    ]

    assert ChunkPlatforms.resolve_entry_y(platforms, 612) == 580
  end

  test "prepare_chunk injects spawn platform at resolved entry" do
    platforms = [%{"y" => 580, "kind" => "solid", "w" => 120, "x" => 100, "h" => 14}]

    {prepared, entry_y} = ChunkPlatforms.prepare_chunk(platforms, 612)

    assert entry_y == 580
    spawn = Enum.find(prepared, &(&1["id"] == "spawn"))
    assert spawn["kind"] == "spawn"
    assert spawn["y"] == 580
  end
end
