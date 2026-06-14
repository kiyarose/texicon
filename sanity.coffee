os = require 'os'
{ exec } = require 'child_process'

totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2)
freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2)

console.log "=== SERVER RESOURCES ==="
console.log "CPU Cores: #{os.cpus().length}"
console.log "Uptime:    #{(os.uptime() / 3600).toFixed(2)} hours"
console.log "RAM Usage: #{freeMem}GB free of #{totalMem}GB"
console.log "------------------------\n"

cmd = if os.platform() is 'win32' then 'tasklist' else 'ps aux | head -n 20'

console.log "=== OPEN PROCESSES ==="
exec cmd, (err, stdout, stderr) ->
  if err
    console.log "Oopsie! Couldn't fetch processes: #{err}"
    return
  console.log stdout