(function() {
  // Healthcheck — verify generated artifacts exist
  var fs, missing, path, required, root;

  fs = require("fs");

  path = require("path");

  root = path.join(__dirname, "..", "texicon");

  required = ["lib/texicon/lol/generated.ex", "assets/js/lol/config.js", "assets/js/lol/commands.js"];

  missing = required.filter(function(rel) {
    return !fs.existsSync(path.join(root, rel));
  });

  if (missing.length) {
    console.error("Missing:", missing.join(", "));
    process.exit(1);
  }

  console.log("healthcheck ok");

}).call(this);
