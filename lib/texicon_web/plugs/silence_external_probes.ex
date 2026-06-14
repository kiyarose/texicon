defmodule TexiconWeb.Plugs.SilenceExternalProbes do
  @moduledoc """
  Returns 204 for Vite/PWA probe paths sent by Cursor Simple Browser,
  Safari, or cached service workers — not part of Texicon.
  """
  import Plug.Conn

  @probe_paths ~w(
    /@react-refresh
    /@vite/client
    /@vite-plugin-pwa/pwa-entry-point-loaded
    /src/main.tsx
    /manifest.webmanifest
    /dev-sw.js
  )

  def init(opts), do: opts

  def call(%Plug.Conn{request_path: path} = conn, _opts) do
    if path in @probe_paths or String.starts_with?(path, "/@vite") do
      conn
      |> put_resp_content_type("text/plain")
      |> send_resp(204, "")
      |> halt()
    else
      conn
    end
  end
end
