// Generated from tuning/props.lol — DO NOT EDIT BY HAND
export const behaviors = {
  "bounce": {
    "trigger": "on_land",
    "params": {
      "vy": -12.5,
      "mult": 1.35
    }
  },
  "fragile": {
    "trigger": "on_land",
    "params": {
      "hits": 2
    }
  },
  "button_spring": {
    "trigger": "on_land",
    "params": {
      "vy": -12.5,
      "mult": 1.2
    }
  },
  "slippery": {
    "trigger": "on_land",
    "params": {
      "friction": 0.12
    }
  },
  "lethal": {
    "trigger": "on_touch",
    "params": {
      "enabled": 1
    }
  },
  "moving": {
    "trigger": "per_frame",
    "params": {
      "speed": 1.2,
      "axis": "x",
      "range": 120
    }
  },
  "gravity_well": {
    "trigger": "item_use",
    "params": {
      "radius": 120,
      "low_mult": 0.04,
      "jump_mult": 0.55,
      "max_fall": 0.35
    }
  },
  "pin_platform": {
    "trigger": "item_use",
    "params": {
      "range": 180,
      "duration": 4000
    }
  },
  "flip_gravity": {
    "trigger": "zone",
    "params": {
      "duration": 3500
    }
  },
  "gravity_zone": {
    "trigger": "zone",
    "params": {
      "gravity": -0.85,
      "pull_x": 0.15,
      "radius": 90
    }
  },
  "magnet": {
    "trigger": "zone",
    "params": {
      "pull": 0.25,
      "radius": 100
    }
  },
  "ladder": {
    "trigger": "on_touch",
    "params": {
      "snap": 1
    }
  },
  "honey": {
    "trigger": "on_touch",
    "params": {
      "impulse": 9
    }
  },
  "honey_jar": {
    "trigger": "item_use",
    "params": {
      "impulse": 11
    }
  },
  "fish_climb": {
    "trigger": "item_use",
    "params": {
      "duration": 5000
    }
  },
  "magnet_boots": {
    "trigger": "item_use",
    "params": {
      "duration": 4500,
      "pull": 0.42
    }
  },
  "swing_rope": {
    "trigger": "item_use",
    "params": {
      "length": 72
    }
  },
  "fish": {
    "trigger": "on_touch",
    "params": {
      "stick": 1
    }
  },
  "hook_shot": {
    "trigger": "item_use",
    "params": {
      "range": 220
    }
  },
  "freeze": {
    "trigger": "item_use",
    "params": {
      "duration": 4000
    }
  },
  "spring": {
    "trigger": "prop_touch",
    "params": {
      "vy": -12.5,
      "mult": 1.5
    }
  },
  "oneway": {
    "trigger": "pre_land",
    "params": {
      "enabled": 1
    }
  },
  "extra_jump": {
    "trigger": "passive",
    "params": {
      "count": 1
    }
  }
}

export const levelChars = {
  "solid": "#",
  "bouncy": "^",
  "oneway": "<",
  "wall": "|",
  "spring": "@",
  "crate": "C",
  "bomb": "B",
  "ice": "~",
  "crumble": "%",
  "lethal": "!",
  "mover": ">",
  "upgrav": "U",
  "flip": "F",
  "pendulum": "P",
  "swing_pendulum": "W",
  "ladder": "L",
  "honey": "H",
  "fish": "f",
  "magnet": "M"
}
