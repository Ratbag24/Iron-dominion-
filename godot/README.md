# Iron Dominion — Godot 4 port

Open `godot/project.godot` in **Godot 4.3** or newer.

This is a port in progress. The JavaScript build in the repository root is the
reference implementation and is fully playable; this directory is where it is
being rebuilt as a native game.

## What is here

| | Status |
|---|---|
| Project, import pipeline, headless test runner | done |
| 40 models as `.glb`, editable in Blender | done |
| Unit and faction data shared with the reference build | done |
| Seeded RNG and value noise, bit-exact with the reference | done |
| Map generation, verified identical to the reference | done |
| Pathfinding, world tick, economy, combat, AI | to do |
| Rendering, camera, HUD | to do |

## Editing models

Every unit and structure is a `.glb` under `assets/models/`. Open one in
Blender, change it, export over the top, and Godot re-imports it.

Each file contains up to three nodes, which the game drives independently:

- **body** — the hull, at the origin
- **turret** — tracks its target; positioned at its pivot
- **spinner** — rotates continuously (drills, turbines, radar dishes)

Keep those node names. `assets/models/manifest.json` records each model's
pivots and materials.

Triangles are grouped into **one material per colour**, named rather than
numbered, so a change takes everywhere at once:

`Hull` `HullDark` `HullLight` `Trim` `Steel` `Concrete` `Deck` `Track`
`Rubber` `Glass` `Glow` `Warhead` `Indicator` `StoreMetal` `StoreEnergy`
`Team` `TeamDark` `TeamLight`

**`Team`, `TeamDark` and `TeamLight` are placeholders.** They are exported as
neutral grey and recoloured per player at runtime, so never bake a player
colour into a model — paint the parts that should carry team colour with those
three materials.

To regenerate the assets from the procedural originals:

```sh
npm run export:models   # -> assets/models/*.glb
npm run export:data     # -> assets/data/*.json
```

## Unit data

`data/units.json` holds every stat: costs, health, speed, weapons, build
options. `data/factions.json` holds the three factions and their rosters. Both
builds read these files, so a balance change is one edit rather than two that
drift apart.

## Tests

```sh
GODOT=/path/to/godot npm run test:godot
```

- **verify_assets** — every model imports with the expected nodes and pivots
- **parity_rng** — the generator reproduces the reference stream bit for bit
- **parity_map** — the same seed produces the same terrain, thresholds, start
  positions and metal spots as the reference build

`data/parity-fixture.json` holds known-good values dumped straight out of the
working JavaScript simulation, so the port is checked against the original
rather than against an assumption about what it used to do.
