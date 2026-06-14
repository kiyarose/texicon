defmodule Texicon.Game.Seed do
  @moduledoc """
  Seed API — delegates to LOLCODE-generated module.
  """

  defdelegate new(), to: Texicon.Lol.Generated
  defdelegate from_param(param), to: Texicon.Lol.Generated
  defdelegate derive(run_seed, chunk_index, purpose), to: Texicon.Lol.Generated
  defdelegate with_rng(run_seed, chunk_index, purpose, fun), to: Texicon.Lol.Generated
  defdelegate rand_float(uniform, min, max), to: Texicon.Lol.Generated
  defdelegate rand_int(uniform, min, max), to: Texicon.Lol.Generated
end
