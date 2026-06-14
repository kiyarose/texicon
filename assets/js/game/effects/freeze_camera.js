export function freezeCamera(_player, itemState, chunk) {
  itemState.frozenUntil = Date.now() + 4000
  for (const p of chunk.props || []) {
    if (p.kind === "pendulum") p.frozen = true
  }
  itemState.uses -= 1
  return true
}
