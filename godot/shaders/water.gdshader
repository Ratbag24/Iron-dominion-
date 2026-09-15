shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, specular_schlick_ggx;

// The sea. A flat tinted plane read as a blue floor; this puts two layers of
// moving ripples on it, fades to the shore where the ground comes up under
// it, and lets the sun glint off the crests. Nothing is textured: the ripple
// normals are a sum of sines, which is cheap and looks right from the game
// camera's height.

uniform vec3 shallow_colour : source_color = vec3(0.07, 0.22, 0.3);
uniform vec3 deep_colour : source_color = vec3(0.02, 0.09, 0.2);
uniform float wave_scale = 0.08;
uniform float wave_speed = 0.6;
uniform float depth_fade = 12.0;

uniform sampler2D depth_texture : hint_depth_texture, filter_linear;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

// Sum-of-sines ripple height, for its slope.
//
// The frequencies are deliberately irrational multiples of each other, and
// the whole field is warped by a slow wave before sampling: with round
// numbers the sum repeats every few dozen units, and from the game camera the
// sea turned into a lattice.
float ripple(vec2 p, float t) {
	vec2 warp = vec2(sin(p.y * 0.173 + t * 0.21), cos(p.x * 0.149 - t * 0.17)) * 1.7;
	p += warp;
	float h = 0.0;
	h += sin(p.x * 1.000 + t * 1.30) * 0.5;
	h += sin((p.x * 0.618 + p.y * 0.786) * 1.732 - t * 1.10) * 0.35;
	h += sin((p.x * -0.707 + p.y * 0.541) * 2.828 + t * 1.90) * 0.2;
	h += sin((p.x * 0.309 + p.y * -0.951) * 5.385 - t * 2.60) * 0.1;
	h += sin((p.x * 0.866 + p.y * 0.500) * 0.271 + t * 0.45) * 0.3;
	return h;
}

void fragment() {
	float t = TIME * wave_speed;
	vec2 p = world_pos.xz * wave_scale;
	float e = 0.05;
	float h0 = ripple(p, t);
	float hx = ripple(p + vec2(e, 0.0), t);
	float hy = ripple(p + vec2(0.0, e), t);
	// Ripple relief fades with distance: past a few hundred units it is
	// below a pixel and only adds shimmer and the lattice.
	float dist = length(world_pos - CAMERA_POSITION_WORLD);
	float relief = 0.12 / (1.0 + dist / 500.0);
	vec3 n = normalize(vec3(-(hx - h0) / e * relief, 1.0, -(hy - h0) / e * relief));
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);

	// How much water lies between the surface and the bed under it, from
	// the depth buffer: thin at the shore, so the sand shows through.
	float scene_depth = texture(depth_texture, SCREEN_UV).r;
	vec3 ndc = vec3(SCREEN_UV * 2.0 - 1.0, scene_depth);
	vec4 view = INV_PROJECTION_MATRIX * vec4(ndc, 1.0);
	view.xyz /= view.w;
	float bed = -view.z;
	float here = -VERTEX.z;
	float depth = clamp((bed - here) / depth_fade, 0.0, 1.0);

	ALBEDO = mix(shallow_colour, deep_colour, depth);
	ALPHA = mix(0.7, 0.95, depth);
	METALLIC = 0.1;
	ROUGHNESS = 0.08;
	SPECULAR = 0.6;
	// Foam-ish brightening on the crests, where the slope is steepest.
	float crest = smoothstep(0.55, 0.9, h0 * 0.5 + 0.5);
	ALBEDO += vec3(0.05) * crest * (1.0 - depth);
}
