defmodule Texicon.Game.ChunkTemplates do
  @moduledoc false

  alias Texicon.Game.Seed
  alias Texicon.Lol.Generated
  alias Texicon.Tex.Registry

  @doc """
  Returns `{:template, level_id}` or `:random`.
  """
  def pick(run_seed, chunk_index, player_effects) do
    templates = Registry.templates()

    if templates == [] do
      :random
    else
      do_pick(templates, run_seed, chunk_index, player_effects)
    end
  end

  defp do_pick(templates, run_seed, chunk_index, player_effects) do
    cfg = Generated.game_config()
    template_pct = cfg[:template_pct] || 60
    gated_pct = cfg[:gated_pct] || 25
    band = difficulty_band(chunk_index)

    pool =
      templates
      |> Enum.filter(fn t -> (t["difficulty"] || 1) <= band end)

    pool = if pool == [], do: templates, else: pool

    Seed.with_rng(run_seed, chunk_index, :template_pick, fn uniform ->
      roll = Seed.rand_int(uniform, 1, 100)

      cond do
        roll <= gated_pct ->
          pick_gated(pool, player_effects, uniform) ||
            pick_template(pool, uniform) ||
            :random

        roll <= gated_pct + template_pct ->
          pick_template(pool, uniform) || :random

        true ->
          :random
      end
    end)
  end

  defp difficulty_band(chunk_index) do
    cond do
      chunk_index < 5 -> 1
      chunk_index < 15 -> 2
      true -> 3
    end
  end

  defp pick_gated(pool, effects, uniform) do
    gated =
      Enum.filter(pool, fn t ->
        need = t["needs_item"]
        need && need in effects
      end)

    case gated do
      [] -> nil
      list -> {:template, weighted_level(list, uniform)}
    end
  end

  defp pick_template(pool, uniform) do
    regular = Enum.reject(pool, &Map.get(&1, "needs_item"))
    list = if regular == [], do: pool, else: regular
    {:template, weighted_level(list, uniform)}
  end

  defp weighted_level(list, uniform) do
    total = Enum.reduce(list, 0, fn t, acc -> acc + (t["weight"] || 1) end)
    target = Seed.rand_int(uniform, 0, max(total - 1, 0))

    {level, _} =
      Enum.reduce_while(list, {nil, 0}, fn t, {_, sum} ->
        next = sum + (t["weight"] || 1)

        if target < next do
          {:halt, {t["level"], next}}
        else
          {:cont, {nil, next}}
        end
      end)

    level || List.first(list)["level"]
  end
end
