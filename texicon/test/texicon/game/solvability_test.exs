defmodule Texicon.Game.SolvabilityTest do
  use ExUnit.Case, async: true

  alias Texicon.Game.Solvability

  test "loadout effects expand vertical reach for solvability checks" do
    chunk = %{
      chunk_type: "normal",
      entry_y: 500,
      exit_y: 350,
      platforms: [
        %{x: 400, y: 500, w: 120, h: 14, kind: "spawn"},
        %{x: 400, y: 355, w: 120, h: 14, kind: "exit"}
      ]
    }

    refute Solvability.valid?(chunk, loadout_effects: [])
    assert Solvability.valid?(chunk, loadout_effects: ["extra_jump"])
  end

  test "interior barriers block paths without clearance tools" do
    chunk = %{
      chunk_type: "normal",
      entry_y: 500,
      exit_y: 60,
      platforms: [
        %{x: 40, y: 500, w: 880, h: 14, kind: "spawn"},
        %{x: 800, y: 500, w: 120, h: 14, kind: "exit"}
      ],
      walls: [
        %{x: 550, y: 290, w: 16, h: 210, kind: "wall", id: "path-barrier-550-500"}
      ]
    }

    refute Solvability.valid?(chunk, loadout_effects: [])
    assert Solvability.valid?(chunk, loadout_effects: ["deploy_spring"])
  end
end
