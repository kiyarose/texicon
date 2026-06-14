defmodule TexiconWeb.PageController do
  use TexiconWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
