defmodule Texicon.Game.ItemPool do
  @moduledoc """
  Random item selection per chunk from `.tex` registry.
  """

  alias Texicon.Game.Seed
  alias Texicon.Tex.Registry

  @puzzle_effects %{
    "gap" => ["grapple_line", "deploy_spring", "bomb_platform"],
    "wall" => ["box_gun", "bomb_platform", "push_block"],
    "pendulum" => ["freeze_camera", "dash", "grapple_line"]
  }

  def all, do: Registry.items()

  def active_pool, do: active_items(all())

  def to_runtime_map(item), do: item_map(item)

  def for_chunk(run_seed, chunk_index, opts \\ []) do
    items = Registry.items()
    if items == [], do: default_item(), else: pick_item(items, run_seed, chunk_index, opts)
  end

  defp pick_item(items, run_seed, chunk_index, opts) do
    effect_filter =
      case Keyword.get(opts, :required_effect) do
        nil -> nil
        effect when is_binary(effect) -> [effect]
        tag when is_binary(tag) -> Map.get(@puzzle_effects, tag, nil)
      end

    pool =
      if effect_filter do
        Enum.filter(items, fn i -> i["effect"] in effect_filter end)
      else
        active_items(items)
      end

    pool = if pool == [], do: items, else: pool

    Seed.with_rng(run_seed, chunk_index, :items, fn uniform ->
      idx = Seed.rand_int(uniform, 0, length(pool) - 1)
      item = Enum.at(pool, idx)
      item_map(item)
    end)
  end

  defp active_items(items) do
    Enum.reject(items, fn i -> i["passive"] == true or i["passive"] == "true" end)
  end

  defp item_map(item) do
    uses = item["uses"]

    %{
      id: item["id"],
      name: item["name"],
      uses: uses,
      max_uses: uses,
      effect: item["effect"],
      description: item["description"],
      passive: item["passive"] in [true, "true"]
    }
  end

  defp default_item do
    %{
      id: "dash",
      name: "Dash",
      uses: 3,
      effect: "dash",
      description: "Horizontal burst",
      passive: false
    }
  end
end
