shader_type canvas_item;

// Combined per-symbol shader: motion-blur while spinning (blur_amount) +
// win glow/outline pulse + dim (pulse_*, dim_amount). One material per
// Sprite2D can only run one shader, and the two effects never actually
// overlap in time (blur only while SPINNING, glow/dim only after the
// reel has landed), so they're merged here instead of two separate
// files fighting over the same material slot.

uniform float blur_amount : hint_range(0.0, 1.0) = 0.0;
uniform float blur_reach : hint_range(0.0, 0.25) = 0.09; // UV units
uniform int blur_samples : hint_range(3, 12) = 7;

uniform float pulse_speed : hint_range(0.0, 8.0) = 0.0;
uniform float pulse_strength : hint_range(0.0, 1.0) = 0.0;
uniform vec4 glow_color : source_color = vec4(1.0, 0.85, 0.35, 1.0);
uniform float dim_amount : hint_range(0.0, 1.0) = 0.0;
uniform float outline_width : hint_range(0.0, 4.0) = 1.5;

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
	if (pulse_strength <= 0.0 && dim_amount <= 0.0) {
		COLOR = tex;
	} else {
		vec2 px = TEXTURE_PIXEL_SIZE;
		float pulse = 0.0;
		if (pulse_strength > 0.0) {
			pulse = (sin(TIME * pulse_speed) * 0.5 + 0.5) * pulse_strength;
		}

		// Cheap 4-tap alpha outline, brightened by the pulse so the glow
		// visibly breathes outward rather than just recoloring in place.
		float outline = 0.0;
		if (pulse_strength > 0.0) {
			float a_up = texture(TEXTURE, UV + vec2(0.0, -px.y * outline_width)).a;
			float a_down = texture(TEXTURE, UV + vec2(0.0, px.y * outline_width)).a;
			float a_left = texture(TEXTURE, UV + vec2(-px.x * outline_width, 0.0)).a;
			float a_right = texture(TEXTURE, UV + vec2(px.x * outline_width, 0.0)).a;
			outline = clamp(a_up + a_down + a_left + a_right, 0.0, 1.0) * (1.0 - tex.a);
		}

		vec3 glow_rgb = glow_color.rgb * (0.6 + pulse);
		vec3 base_rgb = mix(tex.rgb, tex.rgb + glow_rgb * pulse, pulse_strength);
		float base_a = tex.a + outline * glow_color.a * pulse;

		// Dim: desaturate + darken. Used on non-winning cells while WIN_ANIM
		// plays so the eye is pulled straight to the winning line.
		float luma = dot(base_rgb, vec3(0.299, 0.587, 0.114));
		base_rgb = mix(base_rgb, vec3(luma) * 0.55, dim_amount);

		COLOR = vec4(base_rgb, clamp(base_a, 0.0, 1.0));
	}
}
