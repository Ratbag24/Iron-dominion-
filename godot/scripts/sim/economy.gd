class_name IdEconomy

## Resource production and the stall model.
##
## Income is gathered, construction demand is priced, and if demand exceeds
## what the player can pay every builder is throttled by the same ratio. That
## shared throttle is what makes over-expanding in BAR feel the way it does:
## nothing breaks, everything just slows down together.

const BASE_METAL_STORAGE: float = 1000.0
const BASE_ENERGY_STORAGE: float = 1000.0

## How much energy buys one metal in a converter.
const ENERGY_PER_METAL: float = 70.0


static func run_economy(world: IdWorld, dt: float) -> void:
	var players: Array[IdPlayer] = world.players

	for p in players:
		p.metal_income = 0.0
		p.energy_income = 0.0
		p.metal_reclaim = 0.0
		p.metal_storage = BASE_METAL_STORAGE
		p.energy_storage = BASE_ENERGY_STORAGE
		p.converter_capacity = 0.0
		p.metal_wasted = 0.0
		p.energy_wasted = 0.0

	# --- gross production -------------------------------------------------
	for e in world.entities:
		if not e.alive or e.under_construction:
			continue
		var p: IdPlayer = players[e.player]
		var def: Dictionary = e.def

		var mps: float = float(def.get("metalPerSecond", 0.0))
		if mps > 0.0 and not e.metal_spot.is_empty():
			p.metal_income += mps * float(e.metal_spot["yield"])
		p.metal_income += float(def.get("flatMetalPerSecond", 0.0))
		p.energy_income += float(def.get("energyPerSecond", 0.0))
		if bool(def.get("windPowered", false)):
			p.energy_income += 2.0 + 20.0 * world.wind_strength
		p.metal_storage += float(def.get("metalStorage", 0.0))
		p.energy_storage += float(def.get("energyStorage", 0.0))
		p.converter_capacity += float(def.get("convertsEnergy", 0.0))

	# Difficulty handicap: the AI's income multiplier. Human players run at 1.
	for p in players:
		if p.income_multiplier != 1.0:
			p.metal_income *= p.income_multiplier
			p.energy_income *= p.income_multiplier

	# The commander carries its own modest storage, as in BAR.
	for p in players:
		var com: IdEntity = world.get_entity(p.commander_id)
		if com != null and not com.under_construction:
			p.metal_storage += 500.0
			p.energy_storage += 500.0

	# --- price this tick's construction -----------------------------------
	IdConstruction.compute_build_demand(world, dt)

	for p in players:
		var metal_available: float = p.metal + p.metal_income * dt
		var energy_available: float = p.energy + p.energy_income * dt

		p.metal_ratio = (
			clampf(metal_available / p.metal_demand, 0.0, 1.0)
			if p.metal_demand > 1e-9 else 1.0
		)
		p.energy_ratio = (
			clampf(energy_available / p.energy_demand, 0.0, 1.0)
			if p.energy_demand > 1e-9 else 1.0
		)

		var ratio: float = minf(p.metal_ratio, p.energy_ratio)
		p.metal_drain = (p.metal_demand * ratio) / dt
		p.energy_drain = (p.energy_demand * ratio) / dt

		# Credit income before construction spends it.
		p.metal += p.metal_income * dt
		p.energy += p.energy_income * dt
		p.stats["metal_produced"] += p.metal_income * dt

		p.stalling_metal = p.metal_ratio < 0.98 and p.metal_demand > 1e-6
		p.stalling_energy = p.energy_ratio < 0.98 and p.energy_demand > 1e-6


## Run energy converters on whatever energy is left after construction, and
## clamp both resources to storage. Called after apply_construction.
static func settle_economy(world: IdWorld, dt: float) -> void:
	for p in world.players:
		if p.converter_capacity > 0.0:
			# Keep a floor in the bank so converters never cause a stall
			# themselves.
			var floor_amount: float = p.energy_storage * 0.08
			var spare: float = maxf(0.0, p.energy - floor_amount)
			var consumed: float = minf(p.converter_capacity * dt, spare)
			if consumed > 0.0:
				p.energy -= consumed
				var made: float = consumed / ENERGY_PER_METAL
				p.metal += made
				p.metal_income += made / dt
				p.energy_drain += consumed / dt

		if p.metal > p.metal_storage:
			p.metal_wasted = (p.metal - p.metal_storage) / dt
			p.metal = p.metal_storage
		if p.energy > p.energy_storage:
			p.energy_wasted = (p.energy - p.energy_storage) / dt
			p.energy = p.energy_storage
		p.metal = maxf(p.metal, 0.0)
		p.energy = maxf(p.energy, 0.0)
