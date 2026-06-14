defmodule Texicon.Game.ChunkGeneratorTest do
  use ExUnit.Case, async: false

  alias Texicon.Game.{ChunkGenerator, Inventory, Solvability}
  alias Texicon.Tex.Registry

  setup do
    Registry.reload!()
    :ok
  end

  test "generates solvable procedural chunks from seed" do
    effects = Inventory.effects(Inventory.start_loadout(42_424))

    for index <- 1..9 do
      chunk = ChunkGenerator.generate(42_424, index, loadout_effects: effects)
      assert chunk.index == index
      assert Solvability.valid?(chunk, loadout_effects: effects)
      assert chunk.item == nil
    end
  end

  test "procedural normal chunks add item gates from loadout" do
    effects = ["grapple_line", "deploy_spring", "dash"]

    chunks =
      for index <- 1..24, index not in [0, 5, 10, 15, 20] do
        ChunkGenerator.generate(7777, index, loadout_effects: effects)
      end

    normal = Enum.filter(chunks, &(&1.chunk_type == "normal"))

    if normal != [] do
      assert Enum.any?(normal, &Map.get(&1, :item_gate))
    else
      assert Enum.any?(chunks, &Map.get(&1, :suggested_effect))
    end
  end

  test "chunk 0 is milestone start level from lol" do
    chunk = ChunkGenerator.generate(42_424, 0)
    assert chunk.milestone == true
    assert chunk.source == "levels/start.lol"
    assert chunk.item == nil
    assert Solvability.valid?(chunk)
    assert chunk.entry_y >= 520
  end

  test "chunk 5 is puzzle type with loadout reroll" do
    chunk = ChunkGenerator.generate(42_424, 5)
    assert chunk.chunk_type == "puzzle"
    assert chunk.puzzle_tag in ["gap", "wall", "pendulum"]
    assert chunk.required_effect != nil
    assert is_list(chunk.loadout_roll)
    assert length(chunk.loadout_roll) == 3
    assert chunk.required_effect in Enum.map(chunk.loadout_roll, & &1.effect)
  end

  test "chunk 4 has no loadout reroll" do
    effects = Inventory.effects(Inventory.start_loadout(42_424))
    chunk = ChunkGenerator.generate(42_424, 4, loadout_effects: effects)
    assert Map.get(chunk, :loadout_roll) == nil
  end

  test "chunk 10 is shrine milestone" do
    chunk = ChunkGenerator.generate(1, 10)
    assert chunk.source == "levels/shrine.lol"
  end

  test "some procedural chunks use templates" do
    effects = Inventory.effects(Inventory.start_loadout(999))

    types =
      for i <- 1..20 do
        ChunkGenerator.generate(999, i, loadout_effects: effects).chunk_type
      end

    assert "template" in types
  end
end
