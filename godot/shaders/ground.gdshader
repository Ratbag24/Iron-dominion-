shader_type spatial;
render_mode cull_back, depth_draw_opaque;

// The ground, painted from four tiling materials by weight and slope, with the
// hive's corruption layered on top.
//
// The mesh carries no texture of its own. Each vertex says how much of it is
// earth, rock and sand (COLOR.rgb; grass is whatever is left) and a macro
// brightness (COLOR.a) that varies over hundreds of units so the tiling does
// not read as tiling. Every texture is generated at load time by
// IdGroundTextures, so nothing is shipped.

uniform sampler2D grass_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D grass_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D earth_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D earth_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rock_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rock_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D sand_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D sand_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D creep_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D creep_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;

// One texel per simulation cell, 0..1, written by the simulation. Sampled with
// linear filtering so the edge of the infection is a gradient, not a staircase.
uniform sampler2D corruption : hint_default_black, filter_linear, repeat_disable;
// Fog of war, one texel per fog cell: 0 never seen, 0.5 seen once, 1 in
// sight now. Filtered, so the edge of vision is soft. Defaults to white so a
// scene with no viewer (the showcase, the close-up tool) shows everything.
uniform sampler2D fog_map : hint_default_white, filter_linear, repeat_disable;
uniform vec2 map_size = vec2(3072.0, 3072.0);

// World units per texture repeat, near and far. Two scales blended by
// distance to the camera is the cheapest known cure for visible tiling.
uniform float tile_near = 44.0;
uniform float tile_far = 310.0;
uniform float normal_strength = 1.0;
uniform float creep_time = 0.0;

varying vec3 world_pos;
varying vec3 world_normal;
varying vec4 splat;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	splat = COLOR;
}

// Sample a material at both tile scales and blend by camera distance.
vec4 layer(sampler2D tex, vec2 uv, float dist) {
	float k = smoothstep(180.0, 900.0, dist);
	vec4 near = texture(tex, uv / tile_near);
	vec4 far = texture(tex, uv / tile_far);
	return mix(near, far, k);
}

// Rock on a cliff face is projected from the side, not from above: a texture
// laid over the top of a near-vertical face stretches into streaks.
vec4 triplanar(sampler2D tex, vec3 p, vec3 n, float dist) {
	vec3 w = abs(n);
	w = w * w;
	w /= (w.x + w.y + w.z);
	vec4 x = layer(tex, p.zy, dist);
	vec4 y = layer(tex, p.xz, dist);
	vec4 z = layer(tex, p.xy, dist);
	return x * w.x + y * w.y + z * w.z;
}

void fragment() {
	float dist = length(world_pos - CAMERA_POSITION_WORLD);
	vec2 uv = world_pos.xz;
	vec3 n = normalize(world_normal);

	// Weights. Slope pushes everything towards rock regardless of what the
	// simulation called the cell: a cliff is a cliff.
	float steep = 1.0 - smoothstep(0.55, 0.85, n.y);
	float w_earth = splat.r;
	float w_rock = max(splat.g, steep);
	float w_sand = splat.b;
	float w_grass = clamp(1.0 - w_earth - w_rock - w_sand, 0.0, 1.0);
	float total = w_grass + w_earth + w_rock + w_sand;
	w_grass /= total; w_earth /= total; w_rock /= total; w_sand /= total;

	vec3 alb = vec3(0.0);
	vec3 nrm = vec3(0.0);
	if (w_grass > 0.002) {
		alb += layer(grass_albedo, uv, dist).rgb * w_grass;
		nrm += layer(grass_normal, uv, dist).rgb * w_grass;
	}
	if (w_earth > 0.002) {
		alb += layer(earth_albedo, uv, dist).rgb * w_earth;
		nrm += layer(earth_normal, uv, dist).rgb * w_earth;
	}
	if (w_sand > 0.002) {
		alb += layer(sand_albedo, uv, dist).rgb * w_sand;
		nrm += layer(sand_normal, uv, dist).rgb * w_sand;
	}
	if (w_rock > 0.002) {
		alb += triplanar(rock_albedo, world_pos, n, dist).rgb * w_rock;
		nrm += triplanar(rock_normal, world_pos, n, dist).rgb * w_rock;
	}

	// Macro variation: a slow brightness change over the map, carried per
	// vertex, so a field is not one uniform green from edge to edge.
	alb *= 0.78 + splat.a * 0.4;

	// The hive's ground. Where the infection has taken, the surface is flesh:
	// the boundary is pushed around by the texture itself so it grows in
	// lobes rather than as a circle, and the interior pulses slowly.
	float c = texture(corruption, world_pos.xz / map_size).r;
	if (c > 0.001) {
		vec4 creep = layer(creep_albedo, uv + vec2(creep_time * 0.4), dist);
		float lobe = creep.a;
		float edge = smoothstep(0.18, 0.42, c + (lobe - 0.5) * 0.35);
		float pulse = 0.92 + 0.08 * sin(creep_time * 1.7 + creep.a * 6.0);
		alb = mix(alb, creep.rgb * pulse, edge);
		nrm = mix(nrm, layer(creep_normal, uv, dist).rgb, edge);
		// A wet rim just inside the edge, so the front of it reads as moving.
		float rim = smoothstep(0.32, 0.42, edge) * (1.0 - smoothstep(0.42, 0.7, edge));
		alb += vec3(0.35, 0.6, 0.12) * rim * 0.22;
		SPECULAR = mix(0.5, 0.75, edge);
		ROUGHNESS = mix(0.92, 0.55, edge);
	} else {
		SPECULAR = 0.5;
		ROUGHNESS = 0.92;
	}

	// Fog of war last, over everything: unexplored ground is near-black
	// with a cold cast, explored-but-unseen ground is dimmed and desaturated,
	// and only what a unit can see right now is shown as it is.
	// Five taps a third of a cell apart, so the edge of vision is a soft
	// band rather than a staircase of 32-unit cells.
	vec2 fuv = world_pos.xz / map_size;
	vec2 fo = vec2(11.0) / map_size;
	float f = texture(fog_map, fuv).r * 0.36
		+ texture(fog_map, fuv + vec2(fo.x, 0.0)).r * 0.16
		+ texture(fog_map, fuv - vec2(fo.x, 0.0)).r * 0.16
		+ texture(fog_map, fuv + vec2(0.0, fo.y)).r * 0.16
		+ texture(fog_map, fuv - vec2(0.0, fo.y)).r * 0.16;
	float seen = smoothstep(0.0, 0.45, f);
	float now = smoothstep(0.5, 0.95, f);
	vec3 grey = vec3(dot(alb, vec3(0.3, 0.59, 0.11)));
	vec3 dim = mix(grey, alb, 0.45) * 0.55;
	vec3 dark = vec3(0.02, 0.025, 0.04);
	alb = mix(dark, mix(dim, alb, now), seen);

	ALBEDO = alb;
	NORMAL_MAP = nrm;
	NORMAL_MAP_DEPTH = normal_strength;
}
