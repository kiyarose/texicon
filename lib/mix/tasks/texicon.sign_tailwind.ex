defmodule Mix.Tasks.Texicon.SignTailwind do
  @moduledoc "Re-sign Tailwind CLI on macOS after download (fixes exit 137 / invalid signature)"
  @shortdoc "Ad-hoc codesign Tailwind binary on macOS"

  use Mix.Task

  @impl true
  def run(_args) do
    if match?({:unix, :darwin}, :os.type()) do
      Application.ensure_all_started(:tailwind)
      path = Tailwind.bin_path()

      if File.exists?(path) do
        {output, status} =
          System.cmd("codesign", ["-s", "-", "-f", path], stderr_to_stdout: true)

        if status == 0 do
          Mix.shell().info("Signed Tailwind binary for macOS (#{path})")
        else
          Mix.shell().error("codesign failed (#{status}): #{output}")
        end
      else
        Mix.shell().info("Texicon.SignTailwind: no binary at #{path}, skipping")
      end
    end

    :ok
  end
end
