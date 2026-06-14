defmodule TexiconWeb.GameLiveTest do
  use TexiconWeb.ConnCase

  import Phoenix.LiveViewTest

  setup do
    Texicon.Tex.Registry.reload!()
    :ok
  end

  test "game page loads with LOLCODE ui strings", %{conn: conn} do
    {:ok, view, html} = live(conn, ~p"/")

    assert html =~ "Texicon"
    assert html =~ "Press to Start"
    assert html =~ "CAN HAS SEED"
    assert html =~ "0.2.0-lol"
    assert has_element?(view, "canvas#game-canvas")
  end

  test "game page accepts seed param", %{conn: conn} do
    {:ok, _view, html} = live(conn, ~p"/play?seed=12345")

    assert html =~ "Seed: 12345"
  end
end
