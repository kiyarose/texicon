// Dev console — interprets compiled commands/command.lol
// Requires window.TexiconGame and window.TexiconDebug
var MAX_LOG_LINES, appendLog, parseStep;

import {
  commands
} from "../lol/commands.js";

MAX_LOG_LINES = 200;

appendLog = function(text, level = "log") {
  var line, out, ref;
  if (typeof document === "undefined") {
    return;
  }
  out = document.getElementById("dev-console-output");
  if (!out) {
    if (level === "warn") {
      console.warn(text);
    } else {
      console.log(text);
    }
    return;
  }
  line = document.createElement("div");
  line.className = `dev-console-line dev-console-${level}`;
  line.textContent = text;
  out.appendChild(line);
  while (out.childElementCount > MAX_LOG_LINES) {
    if ((ref = out.firstChild) != null) {
      ref.remove();
    }
  }
  out.scrollTop = out.scrollHeight;
  if (level === "warn") {
    return console.warn(text);
  } else {
    return console.log(text);
  }
};

parseStep = function(step, args) {
  var dbg, field, game, getGame, idx, kind, lines, num, parts, path, ref, val, verb;
  parts = step.trim().split(/\s+/);
  verb = (ref = parts[0]) != null ? ref.toLowerCase() : void 0;
  switch (verb) {
    case "log":
      if (parts[1] === "help") {
        lines = Object.values(commands).map(function(c) {
          return `/${c.name} ${c.args} — ${c.help}`.trim();
        });
        return appendLog(lines.join("\n"));
      } else {
        return appendLog(parts.slice(1).join(" "));
      }
      break;
    case "set":
      path = parts[1];
      val = parts.slice(2).join(" ");
      if (path != null ? path.startsWith("player.") : void 0) {
        field = path.split(".")[1];
        getGame = window.TexiconGame;
        game = getGame != null ? getGame() : null;
        if ((game != null ? game.player : void 0) && field) {
          num = parseFloat(val);
          game.player[field] = Number.isNaN(num) ? val : num;
          return appendLog(`player.${field} = ${game.player[field]}`);
        }
      }
      break;
    case "chunk":
      idx = parseInt(args[0], 10);
      dbg = window.TexiconDebug;
      if ((dbg != null ? dbg.jumpToChunk : void 0) != null) {
        dbg.jumpToChunk(idx);
        return appendLog(`Jumped to chunk ${idx}`);
      }
      break;
    case "spawn":
      kind = args[0];
      dbg = window.TexiconDebug;
      if ((dbg != null ? dbg.spawnAtCursor : void 0) != null) {
        dbg.spawnAtCursor(kind, "prop");
        return appendLog(`Spawned ${kind || "prop"} at cursor`);
      }
      break;
    case "give":
      dbg = window.TexiconDebug;
      if ((dbg != null ? dbg.giveEffect : void 0) != null) {
        dbg.giveEffect(args[0]);
        return appendLog(`Granted ${args[0]}`);
      }
      break;
    case "refill":
      dbg = window.TexiconDebug;
      if ((dbg != null ? dbg.refillLoadout : void 0) != null) {
        dbg.refillLoadout();
        return appendLog("Loadout refilled");
      }
      break;
    case "toggle":
      if (parts[1] === "god") {
        dbg = window.TexiconDebug;
        if ((dbg != null ? dbg.toggleGod : void 0) != null) {
          dbg.toggleGod();
          game = typeof window.TexiconGame === "function" ? window.TexiconGame() : void 0;
          return appendLog(`God mode: ${(game != null ? game.godMode : void 0) ? "ON" : "OFF"}`);
        }
      }
      break;
    case "export":
      dbg = window.TexiconDebug;
      if ((dbg != null ? dbg.exportChunk : void 0) != null) {
        return dbg.exportChunk();
      }
      break;
    case "delete":
      dbg = window.TexiconDebug;
      if ((dbg != null ? dbg.deleteSelection : void 0) != null) {
        return dbg.deleteSelection();
      }
      break;
    default:
      return appendLog(`Unknown step: ${step}`, "warn");
  }
};

export var runCommand = function(line) {
  var cmd, head, i, len, name, ref, rest, results, step, trimmed;
  trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  if (trimmed.startsWith("#")) {
    return;
  }
  [head, ...rest] = trimmed.split(/\s+/);
  name = head.replace(/^\//, "").toLowerCase();
  cmd = commands[name];
  if (!cmd) {
    appendLog(`Unknown command: ${name}`, "warn");
    return;
  }
  appendLog(`> ${trimmed}`, "cmd");
  ref = cmd.steps;
  results = [];
  for (i = 0, len = ref.length; i < len; i++) {
    step = ref[i];
    results.push(parseStep(step, rest));
  }
  return results;
};

export var initConsole = function() {
  var input;
  if (typeof document === "undefined") {
    return;
  }
  input = document.getElementById("dev-console-input");
  if (!input) {
    return;
  }
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      runCommand(input.value);
      return input.value = "";
    }
  });
  return window.TexiconConsole = {
    run: runCommand,
    commands,
    log: appendLog
  };
};
