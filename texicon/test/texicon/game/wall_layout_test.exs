defmodule Texicon.Game.WallLayoutTest do
  use ExUnit.Case, async: true

  alias Texicon.Game.{Seed, WallLayout}

  test "adds interior walls on higher-tier chunks" do
    platforms = [
      %{id: "path-1", x: 300, y: 500, w: 120, h: 14, kind: "solid"},
      %{id: "path-2", x: 400, y: 380, w: 120, h: 14, kind: "solid"},
      %{id: "path-3", x: 500, y: 260, w: 120, h: 14, kind: "solid"},
      %{id: "scatter-1", x: 700, y: 420, w: 100, h: 14, kind: "solid"}
    ]

    walls =
      Seed.with_rng(42, 8, :walls, fn uniform ->
        WallLayout.interior_walls(uniform, platforms, 612, 60, 8)
      end)

    assert length(walls) >= 1
    assert Enum.all?(walls, fn w -> w.w == 16 and w.h >= 88 end)
  end

  test "fewer walls on early chunks without scatter platforms" do
    platforms = [
      %{id: "path-1", x: 300, y: 500, w: 120, h: 14, kind: "solid"},
      %{id: "path-2", x: 400, y: 380, w: 120, h: 14, kind: "solid"}
    ]

    walls =
      Seed.with_rng(42, 2, :walls, fn uniform ->
        WallLayout.interior_walls(uniform, platforms, 612, 60, 2)
      end)

    assert walls == []
  end

  test "tall walls only appear when loadout can clear them" do
    platforms = [
      %{id: "path-1", x: 300, y: 500, w: 120, h: 14, kind: "solid"},
      %{id: "path-2", x: 400, y: 380, w: 120, h: 14, kind: "solid"},
      %{id: "path-3", x: 500, y: 260, w: 120, h: 14, kind: "solid"},
      %{id: "scatter-1", x: 700, y: 420, w: 100, h: 14, kind: "solid"}
    ]

    without_tools =
      Seed.with_rng(99, 12, :walls, fn uniform ->
        WallLayout.interior_walls(uniform, platforms, 612, 60, 12, [])
      end)

    with_tools =
      Seed.with_rng(99, 12, :walls, fn uniform ->
        WallLayout.interior_walls(uniform, platforms, 612, 60, 12, ["deploy_spring"])
      end)

    assert Enum.all?(without_tools, fn w -> w.h <= 100 end)
    assert Enum.any?(with_tools, fn w -> w.h > 200 end)
  end
end
