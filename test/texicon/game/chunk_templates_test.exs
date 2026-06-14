defmodule Texicon.Game.ChunkTemplatesTest do
  use ExUnit.Case, async: false

  alias Texicon.Game.ChunkTemplates
  alias Texicon.Tex.Registry

  setup do
    Registry.reload!()
    :ok
  end

  test "pick returns template or random" do
    result = ChunkTemplates.pick(42, 3, ["box_gun"])
    assert result == :random or match?({:template, _}, result)
  end

  test "gated template can match loadout effect" do
    found =
      Enum.any?(1..40, fn i ->
        ChunkTemplates.pick(777, i, ["box_gun"]) == {:template, "templates/wall_box.lol"}
      end)

    assert found
  end

  test "registry includes templates" do
    templates = Registry.templates()
    assert length(templates) >= 10
    assert Enum.any?(templates, &(&1["level"] == "templates/staircase.lol"))
  end
end
