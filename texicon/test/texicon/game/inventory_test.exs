defmodule Texicon.Game.InventoryTest do
  use ExUnit.Case, async: false

  alias Texicon.Game.Inventory
  alias Texicon.Tex.Registry

  setup do
    Registry.reload!()
    :ok
  end

  test "start_loadout returns 3 distinct items for a seed" do
    loadout = Inventory.start_loadout(12345)
    assert length(loadout) == 3
    ids = Enum.map(loadout, & &1.id)
    assert length(Enum.uniq(ids)) == 3
  end

  test "loadout is deterministic for the same seed" do
    a = Inventory.start_loadout(999)
    b = Inventory.start_loadout(999)
    assert Enum.map(a, & &1.id) == Enum.map(b, & &1.id)
  end

  test "reroll every fifth chunk includes puzzle item when required" do
    roll = Inventory.reroll_loadout(123, 5, required_effect: "freeze_camera")
    assert length(roll) == 3
    assert "freeze_camera" in Enum.map(roll, & &1.effect)
  end

  test "reroll is deterministic for seed and chunk index" do
    a = Inventory.reroll_loadout(777, 10, required_effect: "box_gun")
    b = Inventory.reroll_loadout(777, 10, required_effect: "box_gun")
    assert Enum.map(a, & &1.id) == Enum.map(b, & &1.id)
  end
end
