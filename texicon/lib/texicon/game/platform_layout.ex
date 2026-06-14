defmodule Texicon.Game.PlatformLayout do
  @moduledoc false

  alias Texicon.Game.{Difficulty, Seed}

  @exit_line_margin 80

  @doc """
  Filter platforms that overlap the exit-line corridor or each other.
  """
  def finalize(platforms, exit_y, chunk_index \\ 0) do
    platforms
    |> Enum.reduce([], fn plat, acc ->
      if keep?(plat, acc, exit_y, chunk_index), do: acc ++ [plat], else: acc
    end)
  end

  @doc """
  Try to place a scattered platform; returns nil if no valid spot after attempts.
  """
  def try_scattered(uniform, entry_y, exit_y, placed, chunk_index, seq, relax, attempt)
      when attempt < 24 do
    {pw_max, pw_min} = Difficulty.platform_width_range(chunk_index)
    pw = Seed.rand_int(uniform, pw_min, pw_max) + relax * 5
    px = Seed.rand_int(uniform, 40, world_width() - pw - 40)
    py = Seed.rand_int(uniform, 140, entry_y - 100)

    kind =
      case Seed.rand_int(uniform, 0, 20) do
        n when n <= 1 -> "bouncy"
        n when n <= 2 -> "crumble"
        n when n <= 3 -> "ice"
        n when n <= 4 -> "mover"
        _ -> "solid"
      end

    candidate = %{
      x: px,
      y: py,
      w: pw,
      h: 14,
      kind: kind,
      id: "plat-#{chunk_index}-#{seq}"
    }

    if keep?(candidate, placed, exit_y, chunk_index) do
      candidate
    else
      try_scattered(uniform, entry_y, exit_y, placed, chunk_index, seq, relax, attempt + 1)
    end
  end

  def try_scattered(_uniform, _entry_y, _exit_y, _placed, _chunk_index, _seq, _relax, _attempt),
    do: nil

  defp keep?(plat, placed, exit_y, chunk_index) do
    kind = platform_kind(plat)
    gap_x = Difficulty.min_gap_x(chunk_index)
    gap_y = Difficulty.min_gap_y(chunk_index)

    kind in ["spawn", "button_spring"] or
      (not in_exit_corridor?(plat, exit_y) and
         Enum.all?(placed, &(not too_close?(plat, &1, gap_x, gap_y))))
  end

  defp platform_kind(p), do: Map.get(p, :kind) || Map.get(p, "kind")

  defp in_exit_corridor?(plat, exit_y) do
    margin = @exit_line_margin
    plat_bottom = plat.y + plat.h
    plat.y < exit_y + margin and plat_bottom > exit_y - margin
  end

  defp too_close?(a, b, gap_x, gap_y) do
    overlap_x?(a.x, a.x + a.w, b.x, b.x + b.w, gap_x) and
      overlap_y?(a.y, a.y + a.h, b.y, b.y + b.h, gap_y)
  end

  defp overlap_x?(ax1, ax2, bx1, bx2, pad) do
    ax2 + pad > bx1 and bx2 + pad > ax1
  end

  defp overlap_y?(ay1, ay2, by1, by2, pad) do
    ay2 + pad > by1 and by2 + pad > ay1
  end

  defp world_width, do: Texicon.Lol.Generated.game_config()[:world_width]
end
