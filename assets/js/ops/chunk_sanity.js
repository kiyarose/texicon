(function() {
  // Generate chunks 0-15 and assert solvability
  var execSync, path, root, script;

  ({execSync} = require("child_process"));

  path = require("path");

  root = path.join(__dirname, "..", "texicon");

  script = `Mix.run(["app.start"])
alias Texicon.Game.{ChunkGenerator, Inventory, Solvability, Seed}
seed = Seed.new()
loadout = Inventory.start_loadout(seed)
effects = Inventory.effects(loadout)
failed = for i <- 0..15, not Solvability.valid?(ChunkGenerator.generate(seed, i, loadout_effects: effects), loadout_effects: effects), do: i
if failed != [], do: (IO.puts("invalid chunks: \#{inspect failed}"); System.halt(1))
IO.puts "chunk_sanity ok"`;

  execSync(`mix run -e '${script.replace(/'/g, "'\\\\''")}'`, {
    cwd: root,
    stdio: "inherit"
  });

}).call(this);
