import { PHYSICS } from "../physics.js"

export function dash(player, itemState) {
  player.vx = PHYSICS.maxSpeedX * 2.2 * player.facing
  itemState.uses -= 1
  return true
}
