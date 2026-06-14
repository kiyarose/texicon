defmodule Texicon.Tex.RegistryTest do
  use ExUnit.Case, async: false

  alias Texicon.Tex.Registry

  setup do
    Registry.reload!()
    :ok
  end

  test "milestone lookup exact and every" do
    assert Registry.milestone_level(0) == {:ok, "levels/start.lol"}
    assert Registry.milestone_level(10) == {:ok, "levels/shrine.lol"}
    assert Registry.milestone_level(25) == {:ok, "levels/waystation.lol"}
    assert Registry.milestone_level(1) == :procedural
    assert Registry.milestone_level(11) == :procedural
  end

  test "items and block colors from registry" do
    assert length(Registry.items()) == 11
    assert Registry.block_colors()["bouncy"] == "#06d6a0"
    assert Registry.block_colors()["button_spring"] == "#e07a5f"
  end
end
