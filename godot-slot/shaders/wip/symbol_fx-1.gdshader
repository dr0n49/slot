shader_type canvas_item;

// Combined per-symbol shader: motion-blur while spinning (blur_amount) +
// win glow/outline pulse + dim (pulse_*, dim_amount) + idle special-card
// glow (idle_*) + sheen sweep (sheen_*) + win flash (flash_amount).
// One material per Sprite2D can only run one shader, and these effects
// are largely mutually exclusive in time (blur only while SPINNING, glow/
// dim only after landing, idle glow only at rest, flash only on impact),
// so they're merged here instead of separate files fighting over the
// same material slot.

uniform float blur_amount : hint_range(0.0, 1.0) = 0.0;
uniform float blur_reach : hint_range(0.0, 0.25) = 0.09; // UV units
uniform int blur_samples : hint_range(3, 12) = 7;

uniform float pulse_speed : hint_range(0.0, 8.0) = 0.0;
uniform float pulse_strength : hint_range(0.0, 1.0) = 0.0;
uniform vec4 glow_color : source_color = vec4(1.0, 0.85, 0.35, 1.0);
uniform float dim_amount : hint_range(0.0, 1.0) = 0.0;
uniform float outline_width : hint_range(0.0, 4.0) = 1.5;

// Idle "special card" glow (Joker / gold Joker at rest) — same outline
// technique as the win pulse but driven by its own low-amplitude uniform
// so an idle Joker never reads as "this is currently winning".
uniform float idle_glow_strength : hint_range(0.0, 1.0) = 0.0;
uniform vec4 idle_glow_color : source_color = vec4(1.0, 0.82, 0.3, 1.0);
uniform float idle_outline_width : hint_range(0.0, 4.0) = 1.2;

// One-shot diagonal sheen sweep. sheen_pos runs -0.35..1.35 across a
// single pass (script-driven via Tween); sheen_pos < -0.3 or > 1.3 means
// "not running" so the branch below is skipped entirely off-pass.
uniform float sheen_pos : hint_range(-0.5, 1.5) = -0.5;
uniform float sheen_width : hint_range(0.02, 0.4) = 0.16;
uniform float sheen_strength : hint_range(0.0, 1.0) = 0.55;

// Brief additive flash on impact (win-pulse start / multiplier applied).
// Script sets this to ~1.0 then tweens it back to 0 over a few frames.
uniform float flash_amount : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	// TEXTURE (the sprite's implicit sampler2D) is only in scope inside
	// fragment()/vertex()/light() in Godot's shading language — a plain
	// helper function can't reference it, and even passing it in as a
	// sampler2D parameter trips an internal shader-compiler warning on some
	// Godot builds — so the blur loop is inlined here instead of being its
	// own function.
	vec4 tex;
	if (blur_amount > 0.001) {
		vec4 accum = vec4(0.0);
		float total_weight = 0.0;
		float reach = blur_reach * blur_amount;
		for (int i = 0; i < blur_samples; i++) {
			float t = float(i) / float(blur_samples - 1) - 0.5; // -0.5 .. 0.5
			float weight = max(1.0 - abs(t) * 1.4, 0.0);
			vec2 sample_uv = UV + vec2(0.0, t * reach);
			if (sample_uv.y >= 0.0 && sample_uv.y <= 1.0) {
				accum += texture(TEXTURE, sample_uv) * weight;
				total_weight += weight;
			}
		}
		tex = accum / max(total_weight, 0.001);
		tex.a *= mix(1.0, 0.85, blur_amount); // sells "moving too fast to focus on"
	} else {
		tex = texture(TEXTURE, UV);
	}

	// No early `return` here — Godot's shading language rejects a `return`
	// inside fragment()/vertex()/light(), even though it's ordinary GLSL
	// elsewhere. Branch with if/else instead.
	bool any_fx = pulse_strength > 0.0 || dim_amount > 0.0 || idle_glow_strength > 0.0
		|| (sheen_pos > -0.3 && sheen_pos < 1.3) || flash_amount > 0.001;

	if (!any_fx) {
		COLOR = tex;
	} else {
		vec2 px = TEXTURE_PIXEL_SIZE;
		vec3 rgb = tex.rgb;
		float a = tex.a;

		// --- Win pulse (existing behaviour, unchanged in shape) ---
		if (pulse_strength > 0.0) {
			float pulse = (sin(TIME * pulse_speed) * 0.5 + 0.5) * pulse_strength;
			float a_up = texture(TEXTURE, UV + vec2(0.0, -px.y * outline_width)).a;
			float a_down = texture(TEXTURE, UV + vec2(0.0, px.y * outline_width)).a;
			float a_left = texture(TEXTURE, UV + vec2(-px.x * outline_width, 0.0)).a;
			float a_right = texture(TEXTURE, UV + vec2(px.x * outline_width, 0.0)).a;
			float outline = clamp(a_up + a_down + a_left + a_right, 0.0, 1.0) * (1.0 - tex.a);

			vec3 glow_rgb = glow_color.rgb * (0.6 + pulse);
			rgb = mix(rgb, rgb + glow_rgb * pulse, pulse_strength);
			a = a + outline * glow_color.a * pulse;
		}

		// --- Idle special-card glow: same outline technique, low and
		// steady rather than a wide breathing pulse, so a Joker reads as
		// "this card is special" at a glance without competing with an
		// actual win. ---
		if (idle_glow_strength > 0.0) {
			float idle_pulse = (sin(TIME * 1.6) * 0.5 + 0.5) * 0.5 + 0.5; // 0.5..1.0, gentle
			float a_up = texture(TEXTURE, UV + vec2(0.0, -px.y * idle_outline_width)).a;
			float a_down = texture(TEXTURE, UV + vec2(0.0, px.y * idle_outline_width)).a;
			float a_left = texture(TEXTURE, UV + vec2(-px.x * idle_outline_width, 0.0)).a;
			float a_right = texture(TEXTURE, UV + vec2(px.x * idle_outline_width, 0.0)).a;
			float outline = clamp(a_up + a_down + a_left + a_right, 0.0, 1.0) * (1.0 - tex.a);
			float k = idle_glow_strength * idle_pulse;
			rgb = mix(rgb, rgb + idle_glow_color.rgb * 0.45, k * tex.a * 0.35);
			a = a + outline * idle_glow_color.a * k * 0.8;
		}

		// --- One-shot diagonal sheen sweep: a soft light band travelling
		// bottom-left to top-right across the card, masked to the card's
		// own alpha so it reads as light crossing the surface, not a
		// sticker on top of it. ---
		if (sheen_pos > -0.3 && sheen_pos < 1.3 && tex.a > 0.01) {
			float diag = (UV.x + (1.0 - UV.y)) * 0.5; // 0 at bottom-left, 1 at top-right
			float d = abs(diag - sheen_pos);
			float band = smoothstep(sheen_width, 0.0, d);
			rgb += vec3(1.0, 0.97, 0.85) * band * sheen_strength * tex.a;
		}

		// --- Dim: desaturate + darken. Used on non-winning cells while
		// WIN_ANIM plays so the eye is pulled straight to the winning
		// line. Kept short of a full silhouette (max ~0.82) so a dimmed
		// card still reads as a card, not a cut-out. ---
		if (dim_amount > 0.0) {
			float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
			rgb = mix(rgb, vec3(luma) * 0.55, dim_amount);
		}

		// --- Impact flash: brief additive white-gold, decays via script. ---
		if (flash_amount > 0.001) {
			rgb += vec3(1.0, 0.94, 0.8) * flash_amount * tex.a;
		}

		COLOR = vec4(rgb, clamp(a, 0.0, 1.0));
	}
}
