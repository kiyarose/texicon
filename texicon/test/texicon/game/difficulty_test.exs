defmodule Texicon.Game.DifficultyTest do
  use ExUnit.Case, async: true

  alias Texicon.Game.Difficulty

  test "gaps widen as chunk index increases" do
    assert Difficulty.min_gap_y(0) < Difficulty.min_gap_y(10)
    assert Difficulty.min_gap_x(0) < Difficulty.min_gap_x(10)
  end

  test "fewer scattered platforms at higher tiers" do
    assert Difficulty.scattered_count(7, 0, 0) > Difficulty.scattered_count(7, 20, 0)
  end
end
