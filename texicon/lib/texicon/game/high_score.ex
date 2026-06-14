defmodule Texicon.Game.HighScore do
  @moduledoc """
  Persists best run distance via ETS.
  """

  use GenServer

  @table :texicon_high_scores

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])
    load_from_disk()
    {:ok, %{}}
  end

  def get do
    case :ets.lookup(@table, :best) do
      [{:best, data}] -> data
      _ -> default()
    end
  end

  def update(distance, seed) when is_number(distance) do
    current = get()

    new_data =
      if distance > current.best_distance do
        %{
          best_distance: trunc(distance),
          best_seed: seed,
          last_run_distance: trunc(distance)
        }
      else
        %{current | last_run_distance: trunc(distance)}
      end

    :ets.insert(@table, {:best, new_data})
    persist(new_data)
    new_data
  end

  defp default do
    %{best_distance: 0, best_seed: nil, last_run_distance: 0}
  end

  defp persist(data) do
    path = persist_path()

    File.mkdir_p!(Path.dirname(path))
    File.write!(path, Jason.encode!(data))
  end

  defp load_from_disk do
    path = persist_path()

    data =
      if File.exists?(path) do
        path
        |> File.read!()
        |> Jason.decode!()
        |> atomize_keys()
      else
        default()
      end

    :ets.insert(@table, {:best, data})
  end

  defp persist_path do
    Application.get_env(:texicon, :high_score_path, "priv/high_score.json")
  end

  defp atomize_keys(%{"best_distance" => bd, "best_seed" => bs, "last_run_distance" => lrd}) do
    %{best_distance: bd, best_seed: bs, last_run_distance: lrd}
  end

  defp atomize_keys(map) when is_map(map) do
    map
    |> Enum.map(fn {k, v} -> {String.to_existing_atom(k), v} end)
    |> Map.new()
  rescue
    ArgumentError -> default()
  end
end
