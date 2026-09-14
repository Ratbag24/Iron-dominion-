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

> **On sound and art.** There are no audio or texture files in this project
> for the same reason there are no model files in the browser build: every
> sound is synthesised at startup from oscillators and filtered noise, and
> every model and surface is generated in code. Nothing has to be licensed and
> nothing has to be shipped.

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

## The Godot build

The game is being moved to **Godot 4**, so that the models are editable in
Blender and the project can be exported as a desktop build rather than living
only in a browser tab. The simulation was written renderer-agnostic from the
start, which is what made that move possible: the economy, construction,
pathfinding, combat, fog and AI are the same design in both, and the ported
map generator and random number stream are checked against the browser build's
output value for value.

```sh
godot --path godot                        # play
GODOT=/path/to/godot tools/godot-test.sh  # run every suite headlessly
GODOT=/path/to/godot tools/godot-shots.sh # capture the interface states
```

Needs Godot 4.3 or later. The first run imports the models, which takes a
moment; after that it starts straight into the front end.

The models live in `godot/assets/models` as glTF binaries, one per unit, with a
named material per colour — open any of them in Blender, edit, and export over
the top. `tools/export-models.mjs` regenerates them from the procedural source
in `src/client/gfx/models.js`, and `tools/export-data.mjs` writes the unit and
faction data both builds read.

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
| **Mute** | `M` (Godot build) |

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

Three factions, each with its own roster of units and structures. A faction is
a set of definitions plus a *roster* mapping generic slots (extractor, cheap
power, factory, assault, artillery and so on) to definition ids, so everything
that reasons about a faction generically — the AI's entire build order, the
opening spawn, unit composition — works for any of them without special cases.

**Vanguard** — agile bots. Longer range, quicker, and slightly cheaper, with
thinner armour. Wins by arriving first and in numbers.

**Legion** — heavy bots. More armour and more punch at a small premium, and
slower. Wins by not dying.

**Concord** — the human remnant, and a different machine entirely. Tracked
hulls with crews rather than nanolathe swarms: fewer, costlier, tougher
vehicles whose guns come with splash damage as standard, dug-in pillboxes
instead of laser towers, and power in big lumps — diesel generators early, a
single Fusion Reactor later, rather than a field of solar panels. Their
engineers build more slowly than bots do, so they lean on vehicle yards and
construction cranes to convert metal into army.

Balance is measured, not asserted. Across 42 AI-vs-AI matches covering every
ordered pairing, 39 decided: Vanguard 46%, Legion 50%, Concord 43%, with
head-to-head records of 6–6, 7–7 and 5–8.

## Architecture

The simulation is completely independent of the renderer, which is why it can be
tested headlessly and why the 3D layer could be swapped in without touching game
logic.

```
src/
  core/       seeded RNG and noise, vector maths, spatial hash
  sim/        the game itself - no DOM, no WebGL, runs in Node
    defs.js         unit and structure definitions, factions and rosters
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
    gfx/            Three.js scene: terrain, models, environment, instanced
                    rendering and the bloom pipeline
vendor/       three.js r160 and its post-processing addons (MIT), vendored
              so nothing is fetched at runtime
```

Rendering uses one `InstancedMesh` per unit type per player, so a hundred
assault bots cost one draw call. Models are built from chamfered, coloured
primitives and merged at load — around forty thousand triangles across the
forty definitions — with the self-illuminated parts split into their own
geometry so they can be drawn unlit and picked up by the bloom pass.

The ground is rendered from a heightfield of its own, resampled at twice the
simulation's grid with high-frequency noise folded in and a tiling procedural
normal map over the top. The simulation still reasons about its own 16-unit
grid, which is right for pathing and footprints and far too coarse to look at;
everything visual and interactive — the mesh, where units stand, where the
cursor lands — reads back through the finer field, so they all agree. Fog of
war is a data texture on a coarse copy of that surface.

Surfaces are physically based and lit by an image-based environment built from
a procedural sky, which is what makes metal read as metal. The frame runs
through a composer — scene, then bloom at half resolution, then filmic tone
mapping. Bloom is the most expensive thing in the frame by a wide margin, so
there is a **Fast** graphics setting that turns it and shadows off, and the game
switches to it on its own if the frame rate stays below 24 for five seconds.

## Godot port

A native port is under way in `godot/`, with the models exported as editable
`.glb` assets and unit data shared between both builds. See
[`godot/README.md`](godot/README.md) for what is ported so far and how to edit
the models. The JavaScript build here remains the reference implementation and
the playable one.

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
