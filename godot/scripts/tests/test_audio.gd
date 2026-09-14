extends SceneTree

## Checks the synthesised sounds are actually sounds: the right format, a
## sensible length, real amplitude, and a shape that decays rather than
## running flat into its own end.

var failures: int = 0

const EXPECTED := {
	"laser": [0.10, 0.25],
	"cannon": [0.20, 0.40],
	"missile": [0.30, 0.55],
	"artillery": [0.35, 0.60],
	"explosion_small": [0.40, 0.70],
	"explosion_big": [0.80, 1.20],
	"explosion_huge": [1.50, 2.20],
	"build_start": [0.10, 0.30],
	"build_done": [0.30, 0.55],
	"unit_done": [0.20, 0.40],
	"select": [0.03, 0.15],
	"order": [0.04, 0.18],
}


func check(ok: bool, label: String, detail: String = "") -> void:
	var suffix: String = "  (%s)" % detail if detail != "" else ""
	if ok:
		print("  PASS  %s%s" % [label, suffix])
	else:
		print("  FAIL  %s%s" % [label, suffix])
		failures += 1


func _init() -> void:
	print("\nSounds")
	print("------")

	var built := 0
	for name in EXPECTED:
		var s: AudioStreamWAV = IdAudioBank.get_sound(name)
		if s == null:
			check(false, "%s built" % name)
			continue
		built += 1

		var samples: int = s.data.size() / 2
		var length: float = float(samples) / float(s.mix_rate)
		var want: Array = EXPECTED[name]
		var length_ok: bool = length >= want[0] and length <= want[1]

		# Peak, and the energy in the first and last tenth, which is how a
		# decaying envelope shows up in a measurement.
		var peak := 0
		var head := 0.0
		var tail := 0.0
		var clipped := 0
		for i in range(samples):
			var v: int = s.data.decode_s16(i * 2)
			var a: int = absi(v)
			peak = maxi(peak, a)
			if a >= 32767:
				clipped += 1
			if i < samples / 10:
				head += float(a)
			elif i >= samples - samples / 10:
				tail += float(a)

		var loud: bool = peak > 3000
		var decays: bool = tail < head * 0.5
		var clean: bool = float(clipped) / float(maxi(samples, 1)) < 0.01

		check(length_ok and loud and decays and clean, name,
			"%.2fs, peak %d, tail %.0f%% of head, %d clipped"
			% [length, peak, 100.0 * tail / maxf(head, 1.0), clipped])

	check(built == EXPECTED.size(), "every sound built",
		"%d of %d" % [built, EXPECTED.size()])

	# The same name must give the same object back, or a battle synthesises a
	# fresh explosion for every shell.
	check(IdAudioBank.get_sound("cannon") == IdAudioBank.get_sound("cannon"),
		"sounds are cached, not rebuilt")

	var s: AudioStreamWAV = IdAudioBank.get_sound("laser")
	check(s.format == AudioStreamWAV.FORMAT_16_BITS and not s.stereo,
		"format is 16-bit mono", "%d Hz" % s.mix_rate)

	print("")
	if failures == 0:
		print("PASS: every sound is synthesised and well formed")
	else:
		print("FAIL: %d checks failed" % failures)
	quit(1 if failures > 0 else 0)
