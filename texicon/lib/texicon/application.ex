defmodule Texicon.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      TexiconWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:texicon, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Texicon.PubSub},
      Texicon.Game.HighScore,
      # Start a worker by calling: Texicon.Worker.start_link(arg)
      # {Texicon.Worker, arg},
      # Start to serve requests, typically the last entry
      TexiconWeb.Endpoint
    ]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Texicon.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    TexiconWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
