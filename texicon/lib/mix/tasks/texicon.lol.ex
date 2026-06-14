defmodule Mix.Tasks.Texicon.Lol do
  @moduledoc "Compiles LOLCODE sources into Elixir and JS"
  @shortdoc "Compile Texicon LOLCODE"

  use Mix.Task

  @impl true
  def run(_args) do
    script = Path.join(File.cwd!(), "scripts/compile_lol.js")

    unless File.exists?(script) do
      Mix.raise("compile_lol.js not found at #{script}")
    end

    Mix.shell().info("Compiling LOLCODE from lol/")

    {output, status} =
      System.cmd("node", [script], cd: File.cwd!(), stderr_to_stdout: true)

    Mix.shell().info(String.trim(output))

    if status != 0 do
      Mix.raise("LOLCODE compile failed")
    end
  end
end
