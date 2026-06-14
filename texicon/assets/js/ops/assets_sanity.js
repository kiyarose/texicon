(function() {
  var execSync, fs, i, len, path, rel, required, root;

  fs = require("fs");

  path = require("path");

  ({execSync} = require("child_process"));

  root = path.join(__dirname, "..", "texicon");

  execSync("mix texicon.lol && mix texicon.coffee", {
    cwd: root,
    stdio: "inherit"
  });

  required = ["assets/js/lol/config.js", "assets/js/lol/commands.js", "assets/js/game/console.js"];

  for (i = 0, len = required.length; i < len; i++) {
    rel = required[i];
    if (!fs.existsSync(path.join(root, rel))) {
      console.error("Missing:", rel);
      process.exit(1);
    }
  }

  console.log("assets_sanity ok");

}).call(this);
