(function() {
  var ops, path, run, spawnSync;

  ({spawnSync} = require("child_process"));

  path = require("path");

  ops = __dirname;

  run = function(name) {
    var r;
    r = spawnSync("coffee", [path.join(ops, name)], {
      stdio: "inherit"
    });
    if (r.status !== 0) {
      console.error("FAIL:", name);
      return process.exit(r.status);
    }
  };

  console.log("=== full_sanity ===");

  run("healthcheck.coffee");

  run("assets_sanity.coffee");

  run("chunk_sanity.coffee");

  console.log("=== PASS ===");

}).call(this);
