defmodule Texicon.Game.Difficulty do
  @moduledoc """
  Scales procedural chunk spacing and density by climb depth.
  """

  @max_tier 24

  def tier(chunk_index) when chunk_index < 0, do: 0
  def tier(chunk_index), do: min(div(chunk_index, 2), @max_tier)

  def min_gap_y(chunk_index), do: 52 + tier(chunk_index) * 2
  def min_gap_x(chunk_index), do: 20 + tier(chunk_index) * 2

  def scattered_count(base_count, chunk_index, relax) do
    base_count + relax - div(tier(chunk_index), 2) |> max(3)
  end

  def path_steps(chunk_index), do: max(5, 8 - div(tier(chunk_index), 5))

  def path_vertical_stretch(chunk_index), do: 1.0 + tier(chunk_index) * 0.035

  def path_sway(chunk_index), do: 140 + tier(chunk_index) * 3

  def platform_width_range(chunk_index) do
    tier = tier(chunk_index)
    {max(70, 170 - tier * 2), max(90, 110 - div(tier, 2))}
  end
end
