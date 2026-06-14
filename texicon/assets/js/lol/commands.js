// Generated from commands/command.lol — DO NOT EDIT BY HAND
export const commands = {
  "help": {
    "steps": [
      "log help"
    ],
    "name": "help",
    "args": "",
    "help": "List commands"
  },
  "tp": {
    "steps": [
      "set player.x $1",
      "set player.y $2",
      "set player.vx 0",
      "set player.vy 0"
    ],
    "name": "tp",
    "args": "x,y",
    "help": "Teleport to local x y"
  },
  "chunk": {
    "steps": [
      "chunk $1"
    ],
    "name": "chunk",
    "args": "n",
    "help": "Jump to chunk index"
  },
  "spawn": {
    "steps": [
      "spawn prop $1 at cursor"
    ],
    "name": "spawn",
    "args": "kind",
    "help": "Spawn prop at cursor"
  },
  "platform": {
    "steps": [
      "spawn platform $1 $2 $3 at cursor"
    ],
    "name": "platform",
    "args": "kind,w,h",
    "help": "Place platform at cursor"
  },
  "give": {
    "steps": [
      "give $1"
    ],
    "name": "give",
    "args": "effect",
    "help": "Grant item by effect id"
  },
  "refill": {
    "steps": [
      "refill"
    ],
    "name": "refill",
    "args": "",
    "help": "Refill loadout uses"
  },
  "god": {
    "steps": [
      "toggle god"
    ],
    "name": "god",
    "args": "",
    "help": "Toggle invincibility"
  },
  "export": {
    "steps": [
      "export chunk"
    ],
    "name": "export",
    "args": "",
    "help": "Dump current chunk JSON"
  },
  "delete": {
    "steps": [
      "delete selection"
    ],
    "name": "delete",
    "args": "",
    "help": "Delete selected dev entity"
  }
}
