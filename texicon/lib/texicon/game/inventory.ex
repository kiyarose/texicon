defmodule Texicon.Game.Inventory do
  @moduledoc false

  alias Texicon.Game.{ItemPool, Seed}

  @loadout_size 3
  @reroll_every 5

  def start_loadout(run_seed) do
    pool = ItemPool.active_pool()

    Seed.with_rng(run_seed, 0, :loadout, fn uniform ->
      pick_distinct(pool, @loadout_size, uniform)
    end)
  end

  def reroll?(chunk_index) when chunk_index > 0, do: rem(chunk_index, @reroll_every) == 0
  def reroll?(_), do: false

  def reroll_loadout(run_seed, chunk_index, opts \\ []) do
    pool = ItemPool.active_pool()
    required = Keyword.get(opts, :required_effect)

    Seed.with_rng(run_seed, chunk_index, :loadout_reroll, fn uniform ->
      pool
      |> pick_distinct(@loadout_size, uniform)
      |> maybe_ensure_effect(pool, required)
    end)
  end

  def effects(loadout) do
    loadout
    |> List.wrap()
    |> Enum.map(fn item -> item[:effect] || item["effect"] end)
    |> Enum.reject(&is_nil/1)
  end

  defp maybe_ensure_effect(loadout, _pool, nil), do: loadout

  defp maybe_ensure_effect(loadout, pool, required) when is_binary(required) do
    effects = Enum.map(loadout, & &1.effect)

    if required in effects do
      loadout
    else
      case Enum.find(pool, &(&1["effect"] == required)) do
        nil ->
          loadout

        item ->
          mapped = ItemPool.to_runtime_map(item)
          List.replace_at(loadout, 0, mapped)
      end
    end
  end

  defp pick_distinct(pool, count, uniform) when length(pool) >= count do
    {picked, _} =
      Enum.reduce(1..count, {[], MapSet.new()}, fn _, {acc, used} ->
        idx = pick_unused_index(pool, used, uniform)
        item = Enum.at(pool, idx)
        {[ItemPool.to_runtime_map(item) | acc], MapSet.put(used, idx)}
      end)

    Enum.reverse(picked)
  end

  defp pick_distinct(pool, _count, _uniform) do
    pool |> Enum.take(@loadout_size) |> Enum.map(&ItemPool.to_runtime_map/1)
  end

  defp pick_unused_index(pool, used, uniform) do
    size = length(pool)

    Stream.repeatedly(fn -> Seed.rand_int(uniform, 0, size - 1) end)
    |> Enum.find(fn i -> not MapSet.member?(used, i) end)
  end
end
