ExUnit.start()

registry = Path.join([File.cwd!(), "priv", "texicon", "registry.json"])

unless File.exists?(registry) do
  Mix.Task.run("texicon.tex")
end

generated = Path.join([File.cwd!(), "lib", "texicon", "lol", "generated.ex"])

unless File.exists?(generated) do
  Mix.Task.run("texicon.lol")
end

Texicon.Tex.Registry.reload!()
