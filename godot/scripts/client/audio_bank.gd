class_name IdAudioBank

## Every sound in the game, synthesised at startup.
##
## There are no audio files in this project for the same reason there are no
## texture files: everything is generated, so nothing has to be licensed and
## nothing has to be shipped. Each sound is a short envelope over noise and a
## few oscillators, which is enough for the industrial palette this wants —
## cannon thumps, laser zaps, debris, and the hum of a nanolathe.

const RATE: int = 22050

static var _cache: Dictionary = {}
static var _rng: RandomNumberGenerator = null


## A named sound, built the first time it is asked for.
static func get_sound(name: String) -> AudioStreamWAV:
	if _cache.has(name):
		return _cache[name]
	var stream: AudioStreamWAV = _build(name)
	_cache[name] = stream
	return stream


## Build everything now rather than on first use, so a burst of fighting does
## not synthesise its own soundtrack mid-frame.
static func warm() -> void:
	for name in [
		"laser", "cannon", "missile", "artillery",
		"explosion_small", "explosion_big", "explosion_huge",
		"build_start", "build_done", "unit_done", "select", "order",
	]:
		get_sound(name)


static func _noise() -> float:
	if _rng == null:
		_rng = RandomNumberGenerator.new()
		# Fixed, so the sounds are the same every run.
		_rng.seed = 0x5057D1
	return _rng.randf() * 2.0 - 1.0


static func _build(name: String) -> AudioStreamWAV:
	match name:
		"laser":
			return _weapon(0.16, 1650.0, 420.0, 0.18, 0.004)
		"cannon":
			return _weapon(0.30, 190.0, 55.0, 0.62, 0.002)
		"missile":
			return _weapon(0.42, 320.0, 120.0, 0.75, 0.010)
		"artillery":
			return _weapon(0.46, 120.0, 38.0, 0.70, 0.003)
		"explosion_small":
			return _explosion(0.55, 260.0, 0.85)
		"explosion_big":
			return _explosion(0.95, 150.0, 1.0)
		"explosion_huge":
			return _explosion(1.8, 82.0, 1.0)
		"build_start":
			return _chirp(0.18, 420.0, 760.0, 0.22)
		"build_done":
			return _chord(0.42, [523.25, 783.99], 0.26)
		"unit_done":
			return _chord(0.28, [392.0, 587.33], 0.20)
		"select":
			return _chirp(0.07, 880.0, 1240.0, 0.14)
		"order":
			return _chirp(0.09, 660.0, 440.0, 0.14)
	push_warning("unknown sound: %s" % name)
	return _chirp(0.05, 440.0, 440.0, 0.1)


## A gun: a pitch sweeping downwards, roughened with noise, under a sharp
## attack and an exponential tail. `grit` is how much of it is noise rather
## than tone, which is most of the difference between a laser and a cannon.
static func _weapon(
	length: float, start_hz: float, end_hz: float, grit: float, attack: float
) -> AudioStreamWAV:
	var count := int(RATE * length)
	var data := PackedByteArray()
	data.resize(count * 2)
	var phase := 0.0
	for i in range(count):
		var t := float(i) / float(count)
		var hz: float = start_hz * pow(end_hz / start_hz, t)
		phase += TAU * hz / float(RATE)
		var tone := sin(phase)
		var env: float = minf(1.0, float(i) / maxf(1.0, attack * RATE)) * pow(1.0 - t, 2.2)
		var v: float = (tone * (1.0 - grit) + _noise() * grit) * env * 0.55
		_put(data, i, v)
	return _wav(data)


## A detonation: a body of low noise dropping in pitch, with a crack on the
## front so it reads at a distance.
static func _explosion(length: float, body_hz: float, weight: float) -> AudioStreamWAV:
	var count := int(RATE * length)
	var data := PackedByteArray()
	data.resize(count * 2)
	var phase := 0.0
	var low := 0.0
	for i in range(count):
		var t := float(i) / float(count)
		var hz: float = body_hz * (1.0 - t * 0.62)
		phase += TAU * hz / float(RATE)

		# A one-pole filter on the noise, which is what turns a hiss into
		# rubble.
		low += (_noise() - low) * 0.22
		var crack: float = pow(1.0 - minf(t * 9.0, 1.0), 3.0)
		var body: float = sin(phase) * weight
		var env: float = pow(1.0 - t, 1.7)
		var v: float = (low * 2.4 * (0.35 + crack) + body * 0.8) * env * 0.5
		_put(data, i, clampf(v, -1.0, 1.0))
	return _wav(data)


static func _chirp(
	length: float, start_hz: float, end_hz: float, gain: float
) -> AudioStreamWAV:
	var count := int(RATE * length)
	var data := PackedByteArray()
	data.resize(count * 2)
	var phase := 0.0
	for i in range(count):
		var t := float(i) / float(count)
		var hz: float = start_hz + (end_hz - start_hz) * t
		phase += TAU * hz / float(RATE)
		# Squared off a little, so it cuts through an engagement.
		var tone: float = sin(phase) * 0.8 + sin(phase * 2.0) * 0.2
		var env: float = minf(1.0, t * 24.0) * pow(1.0 - t, 1.4)
		_put(data, i, tone * env * gain)
	return _wav(data)


static func _chord(length: float, notes: Array, gain: float) -> AudioStreamWAV:
	var count := int(RATE * length)
	var data := PackedByteArray()
	data.resize(count * 2)
	for i in range(count):
		var t := float(i) / float(count)
		var v := 0.0
		for n in range(notes.size()):
			# The notes arrive in turn rather than together, which is what
			# makes it read as a confirmation instead of a beep.
			var start: float = float(n) / float(notes.size()) * 0.35
			if t < start:
				continue
			var local: float = (t - start) / maxf(0.001, 1.0 - start)
			var hz: float = notes[n]
			v += sin(TAU * hz * float(i) / float(RATE)) * pow(1.0 - local, 1.8)
		var env: float = minf(1.0, t * 40.0)
		_put(data, i, v / float(notes.size()) * env * gain)
	return _wav(data)


static func _put(data: PackedByteArray, index: int, value: float) -> void:
	var v := int(clampf(value, -1.0, 1.0) * 32767.0)
	data.encode_s16(index * 2, v)


static func _wav(data: PackedByteArray) -> AudioStreamWAV:
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = data
	return w
