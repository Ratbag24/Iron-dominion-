# Iron Dominion

A 3D real-time strategy game in the tradition of **Beyond All Reason** — the dual
metal/energy economy, nanolathe construction, reclaim, tech tiers, and armies
that grow until one commander is left standing.

**Play it at https://ratbag24.github.io/Iron-dominion-/**

It runs in a browser with no install, no build step and no network: open the
page and play. Every push rebuilds that page automatically, and the simulation
tests have to pass before it deploys.

<sub>The deploy runs from `main` only, and needs **Settings → Pages → Source**
set to **GitHub Actions**. It cannot set that itself: the Actions token has no
repository-admin scope, and the `github-pages` environment refuses deployments
from any branch but the default one.</sub>

> **On the relationship to Beyond All Reason.** This is not a copy of BAR, and
> it contains none of its code or assets. BAR is a decade of work by a large
> team on the Recoil engine, with thousands of models, textures and sounds that
> belong to their authors. What this project reproduces is BAR's *design*: the
> mechanics that make it play the way it does. Every line of code, every model
> and every sound here is original and procedural.

## Play

The hosted build above needs nothing but a browser. To run it from a checkout:

```sh
npm run dev          # serves on http://localhost:8000
```

Needs a mouse and keyboard — it is a full RTS control scheme, not a touch game.

Or build a single self-contained file you can open by double-clicking:

```sh
npm install          # only needed for the build (esbuild)
npm run build        # -> dist/iron-dominion.html
```

## Controls

| | |
|---|---|
| **Camera** | Arrow keys or screen edge to pan, middle-drag to pan, wheel to zoom |
| **Rotate view** | `[` `]` or Shift + middle-drag |
| **Jump to commander** | `H` — reset camera with `Home` |
| **Select** | Left click · drag a box · double-click for all of that type on screen |
| **Add to selection** | Shift + click |
| **Control groups** | `Ctrl`+`0`–`9` to set, `0`–`9` to recall |
| **Next idle builder** | `Tab` |
| **Orders** | Right click for the contextual order, Shift to queue |
| **Attack move / Stop** | `A` / `S` |
| **Guard / Patrol** | `D` / `F` |
| **Reclaim / Repair** | `E` / `R` |
| **Build** | `Q W T Y U I Z X C V B N` (shown on each build button) |
| **Queue 5 units** | Shift + click a unit in a factory's menu |
| **Rally point** | Right click the ground with a factory selected |
| **Pause / Speed** | `Space` · `+` and `-` |

## How the game works

**Economy.** Two resources flow continuously. Metal comes from extractors built
on fixed metal spots, energy from solar collectors and wind turbines. Everything
you build drains both over the duration of the build. If demand outruns income,
nothing breaks — every builder is throttled by the same ratio, and the HUD warns
you that you are stalling. Managing that balance is the game.

**Construction.** Builders have *build power*. A structure has a *build time*,
and any number of builders can nanolathe the same site, stacking their build
power and finishing it proportionally faster. Unfinished things are fragile
nanoframes, which makes raiding a builder worthwhile. Builders also repair,
reclaim wreckage back into metal, and assist factories.

**Tech.** Tier 1 bots come out of a Bot Lab. An Advanced Bot Lab unlocks tier 2:
heavy brawlers and long-range siege artillery. Construction turrets and extra
labs turn a strong economy into army faster.

**Intel.** You see what your units see. Radar towers reveal moving contacts as
blips without identifying them, and structures you have seen stay on the map as
ghosts until you look again.

**Victory.** Kill the enemy commander. Losing yours ends the match, and a dying
commander takes its surroundings with it.

## Factions

|  | Vanguard | Legion |
|---|---|---|
| Health | −8% | +14% |
| Speed | +10% | −7% |
| Damage | −5% | +10% |
| Range | +8% | −4% |
| Cost | −4% | +5% |

Both have the same roster of 20 units and structures with distinct silhouettes.

## Architecture

The simulation is completely independent of the renderer, which is why it can be
tested headlessly and why the 3D layer could be swapped in without touching game
logic.

```
src/
  core/       seeded RNG and noise, vector maths, spatial hash
  sim/        the game itself - no DOM, no WebGL, runs in Node
    defs.js         unit and structure definitions
    map.js          symmetric procedural maps, metal spots, nav grid
    world.js        entities, players, the fixed 30 Hz tick
    economy.js      income, storage, converters, stall throttling
    construction.js nanolathe build/repair/reclaim, factory production
    orders.js       order execution, assist and auto-assist
    movement.js     path following, steering, separation
    pathfinder.js   A* with string pulling and a per-tick budget
    combat.js       target acquisition and firing
    projectiles.js  ballistic, homing and beam projectiles
    fog.js          line of sight, radar, remembered structures
    ai.js           the skirmish AI
  client/     camera, input, HUD, minimap, procedural audio
    art.js          flat silhouettes for build-menu and selection icons
    gfx/            Three.js scene: terrain, models, instanced rendering
vendor/       three.js r160 (MIT), vendored so nothing is fetched at runtime
```

Rendering uses one `InstancedMesh` per unit type per player, so a hundred
assault bots cost one draw call. Models are built from coloured primitives and
merged at load; the terrain is a flat-shaded displaced heightfield; fog of war
is a data texture on a coarse copy of that surface.

## Tests

```sh
npm run test:sim       # headless simulation - 30 checks
npm run test:browser   # drives the real game in Chromium - 17 checks
npm test               # both
```

The simulation suite runs full AI-vs-AI matches and asserts that the economy,
construction, stalling, reclaim, production and combat all behave, that maps are
always symmetric and connected, and that matches reach a decisive result without
either faction dominating. The browser suite loads the real page, checks WebGL
and picking, then builds a base, produces units and issues orders through the
game's own code paths.

## License

MIT. Three.js is included under its own MIT license (`vendor/THREE-LICENSE`).
