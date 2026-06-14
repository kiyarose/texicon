defmodule Texicon.Lol.Generated do
  @moduledoc """
  Generated from LOLCODE sources in tuning/, commands/, hazards/ — DO NOT EDIT BY HAND.
  Run `mix texicon.lol` to regenerate.
  """

  @max_seed 999999999
  @version "0.2.0-lol"
  @build "texicon-can-haz-seed"

  @ui %{
    title: "Texicon",
    subtitle: "Infinite climb. Random terrain. Random tools.",
    hint: "WASD / Arrows move · Space jump · 1/2/3 select item · E use",
    start_btn: "Press to Start",
    dead_title: "Fallen",
    retry_btn: "Try Again",
    lol_label: "CAN HAS SEED N UI FROM LOLCODE"
  }

  @hud %{
    distance_suffix: "m",
    item_label: "Item:",
    uses_label: "Uses:",
    best_label: "Best:",
    seed_label: "Seed:",
    empty: "—",
    copy_btn: "Copy",
    copied_btn: "Copied!",
    slot_label: "Slot",
    empty_slot: "Empty",
    inventory_hint: "1/2/3 select · E use · reroll every 5 chunks"
  }

  @game_config %{
    chunk_height: 660,
    world_width: 960,
    buffer_ahead: 2,
    death_fall_chunks: 2.2,
    template_pct: 12,
    gated_pct: 8,
    random_pct: 80,
    descent_window: 8,
    descent_shrink: 1,
    poison_dps: 0.15
  }

  @hazard_config %{
    spike_chance: 42,
    spike_min_tier: 1,
    spike_strip_w: 24,
    pendulum_chance: 28,
    pendulum_min_tier: 2,
    crumble_spike_chance: 22,
    hazard_side_only: 0
  }

  @dev_commands %{
    help: %{
      steps: [
        "log help"
      ],
      name: "help",
      args: "",
      help: "List commands"
    },
    tp: %{
      steps: [
        "set player.x $1",
        "set player.y $2",
        "set player.vx 0",
        "set player.vy 0"
      ],
      name: "tp",
      args: "x,y",
      help: "Teleport to local x y"
    },
    chunk: %{
      steps: [
        "chunk $1"
      ],
      name: "chunk",
      args: "n",
      help: "Jump to chunk index"
    },
    spawn: %{
      steps: [
        "spawn prop $1 at cursor"
      ],
      name: "spawn",
      args: "kind",
      help: "Spawn prop at cursor"
    },
    platform: %{
      steps: [
        "spawn platform $1 $2 $3 at cursor"
      ],
      name: "platform",
      args: "kind,w,h",
      help: "Place platform at cursor"
    },
    give: %{
      steps: [
        "give $1"
      ],
      name: "give",
      args: "effect",
      help: "Grant item by effect id"
    },
    refill: %{
      steps: [
        "refill"
      ],
      name: "refill",
      args: "",
      help: "Refill loadout uses"
    },
    god: %{
      steps: [
        "toggle god"
      ],
      name: "god",
      args: "",
      help: "Toggle invincibility"
    },
    export: %{
      steps: [
        "export chunk"
      ],
      name: "export",
      args: "",
      help: "Dump current chunk JSON"
    },
    delete: %{
      steps: [
        "delete selection"
      ],
      name: "delete",
      args: "",
      help: "Delete selected dev entity"
    }
  }

  @level_config %{
    cell_size: 10,
    platform_h: 14,
    prop_size: 28
  }

  @behaviors %{
    bounce: %{
      trigger: "on_land",
      params: %{
        vy: -12.5,
        mult: 1.35
      }
    },
    fragile: %{
      trigger: "on_land",
      params: %{
        hits: 2
      }
    },
    button_spring: %{
      trigger: "on_land",
      params: %{
        vy: -12.5,
        mult: 1.2
      }
    },
    slippery: %{
      trigger: "on_land",
      params: %{
        friction: 0.12
      }
    },
    lethal: %{
      trigger: "on_touch",
      params: %{
        enabled: 1
      }
    },
    moving: %{
      trigger: "per_frame",
      params: %{
        speed: 1.2,
        axis: "x",
        range: 120
      }
    },
    gravity_well: %{
      trigger: "item_use",
      params: %{
        radius: 120,
        low_mult: 0.04,
        jump_mult: 0.55,
        max_fall: 0.35
      }
    },
    pin_platform: %{
      trigger: "item_use",
      params: %{
        range: 180,
        duration: 4000
      }
    },
    flip_gravity: %{
      trigger: "zone",
      params: %{
        duration: 3500
      }
    },
    gravity_zone: %{
      trigger: "zone",
      params: %{
        gravity: -0.85,
        pull_x: 0.15,
        radius: 90
      }
    },
    magnet: %{
      trigger: "zone",
      params: %{
        pull: 0.25,
        radius: 100
      }
    },
    ladder: %{
      trigger: "on_touch",
      params: %{
        snap: 1
      }
    },
    honey: %{
      trigger: "on_touch",
      params: %{
        impulse: 9
      }
    },
    honey_jar: %{
      trigger: "item_use",
      params: %{
        impulse: 11
      }
    },
    fish_climb: %{
      trigger: "item_use",
      params: %{
        duration: 5000
      }
    },
    magnet_boots: %{
      trigger: "item_use",
      params: %{
        duration: 4500,
        pull: 0.42
      }
    },
    swing_rope: %{
      trigger: "item_use",
      params: %{
        length: 72
      }
    },
    fish: %{
      trigger: "on_touch",
      params: %{
        stick: 1
      }
    },
    hook_shot: %{
      trigger: "item_use",
      params: %{
        range: 220
      }
    },
    freeze: %{
      trigger: "item_use",
      params: %{
        duration: 4000
      }
    },
    spring: %{
      trigger: "prop_touch",
      params: %{
        vy: -12.5,
        mult: 1.5
      }
    },
    oneway: %{
      trigger: "pre_land",
      params: %{
        enabled: 1
      }
    },
    extra_jump: %{
      trigger: "passive",
      params: %{
        count: 1
      }
    }
  }

  @level_chars %{
    solid: "#",
    bouncy: "^",
    oneway: "<",
    wall: "|",
    spring: "@",
    crate: "C",
    bomb: "B",
    ice: "~",
    crumble: "%",
    lethal: "!",
    mover: ">",
    upgrav: "U",
    flip: "F",
    pendulum: "P",
    swing_pendulum: "W",
    ladder: "L",
    honey: "H",
    fish: "f",
    magnet: "M"
  }

  def version, do: @version
  def build, do: @build
  def ui, do: @ui
  def hud, do: @hud
  def game_config, do: @game_config
  def hazard_config, do: @hazard_config
  def dev_commands, do: @dev_commands
  def level_config, do: @level_config
  def behaviors, do: @behaviors
  def level_chars, do: @level_chars

  def new do
    :rand.uniform(@max_seed)
  end

  def from_param(nil), do: new()
  def from_param(""), do: new()

  def from_param(seed) when is_binary(seed) do
    case Integer.parse(seed) do
      {n, _} when n > 0 -> n
      _ -> new()
    end
  end

  def derive(run_seed, chunk_index, purpose)
      when is_integer(run_seed) and is_integer(chunk_index) do
    purpose_hash = :erlang.phash2(purpose)
    :erlang.phash2({run_seed, chunk_index, purpose_hash})
  end

  def with_rng(run_seed, chunk_index, purpose, fun) when is_function(fun, 1) do
    derived = derive(run_seed, chunk_index, purpose)
    seed = {derived, derived, derived}
    :rand.seed(:exsss, seed)
    fun.(fn -> :rand.uniform_real() end)
  end

  def rand_float(uniform, min, max) do
    min + uniform.() * (max - min)
  end

  def rand_int(uniform, min, max) do
    trunc(min + uniform.() * (max - min + 1))
  end
end
