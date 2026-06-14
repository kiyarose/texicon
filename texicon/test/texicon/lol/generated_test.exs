defmodule Texicon.Lol.GeneratedTest do
  use ExUnit.Case, async: true

  alias Texicon.Lol.Generated

  test "version and ui from LOLCODE" do
    assert Generated.version() =~ "lol"
    assert Generated.ui()[:title] == "Texicon"
    assert Generated.ui()[:start_btn] == "Press to Start"
  end

  test "seed derive is deterministic" do
    a = Generated.derive(42, 3, :terrain)
    b = Generated.derive(42, 3, :terrain)
    assert a == b
    assert is_integer(Generated.new())
  end

  test "exports behavior presets from props.lol" do
    behaviors = Generated.behaviors()
    assert Map.has_key?(behaviors, :bounce)
    assert behaviors[:bounce][:params][:mult] != nil
  end

  test "exports level char map" do
    chars = Generated.level_chars()
    assert chars[:solid] == "#"
    assert chars[:bouncy] == "^"
  end

  test "exports level config" do
    cfg = Generated.level_config()
    assert cfg[:cell_size] == 10
    assert cfg[:platform_h] == 14
  end
end
