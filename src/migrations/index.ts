import * as migration_20261113_075429_init from './20261113_075429_init'
import * as migration_20261113_080000_lockdown from './20261113_080000_lockdown'

export const migrations = [
  { up: migration_20261113_075429_init.up, down: migration_20261113_075429_init.down, name: '20261113_075429_init' },
  { up: migration_20261113_080000_lockdown.up, down: migration_20261113_080000_lockdown.down, name: '20261113_080000_lockdown' },
]
