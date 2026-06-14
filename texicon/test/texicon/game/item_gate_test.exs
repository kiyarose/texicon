defmodule Texicon.Game.ItemGateTest do
  use ExUnit.Case, async: true

  alias Texicon.Game.{ItemGate, Seed, Solvability}

  test "active_effects excludes passives" do
    assert ItemGate.active_effects(["extra_jump", "dash", "gravity_well"]) == [
             "dash",
             "gravity_well"
           ]
  end

  test "horizontal gate widens path gap beyond bare reach" do
    chunk = %{
      index: 4,
      chunk_type: "normal",
      entry_y: 612,
      exit_y: 60,
      platforms: [
        %{id: "path-1", x: 300, y: 500, w: 120, h: 14, kind: "solid"},
        %{id: "path-2", x: 320, y: 500, w: 120, h: 14, kind: "solid"}
      ],
      walls: [
        %{x: 0, y: 0, w: 16, h: 660, kind: "wall"},
        %{x: 944, y: 0, w: 16, h: 660, kind: "wall"}
      ],
      props: []
    }

    {gated, effect} =
      Seed.with_rng(77, 4, :gate, fn uniform ->
        ItemGate.apply(uniform, chunk, ["grapple_line"], 4, force: true)
      end)

    assert effect == "grapple_line"
    assert gated.item_gate == "grapple_line"
    assert Enum.at(gated.platforms, 1).x > 400
    refute Solvability.valid?(gated, loadout_effects: [])
  end

  test "vertical gate stretches path beyond bare jump height" do
    chunk = %{
      index: 6,
      chunk_type: "normal",
      entry_y: 612,
      exit_y: 60,
      platforms: [
        %{id: "path-1", x: 400, y: 500, w: 120, h: 14, kind: "solid"},
        %{id: "path-2", x: 400, y: 390, w: 120, h: 14, kind: "solid"},
        %{id: "path-3", x: 400, y: 90, w: 120, h: 14, kind: "exit"}
      ],
      walls: [
        %{x: 0, y: 0, w: 16, h: 660, kind: "wall"},
        %{x: 944, y: 0, w: 16, h: 660, kind: "wall"}
      ],
      props: []
    }

    {gated, effect} =
      Seed.with_rng(88, 6, :gate, fn uniform ->
        ItemGate.apply(uniform, chunk, ["deploy_spring"], 6, force: true)
      end)

    assert effect == "deploy_spring"
    assert gated.item_gate == "deploy_spring"
    upper = Enum.find(gated.platforms, &(&1.id == "path-2"))
    assert upper.y < 390
  end
end
