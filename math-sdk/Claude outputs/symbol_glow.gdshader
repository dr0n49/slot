shader_type canvas_item;

// Winning-symbol glow/outline pulse (scale breathing is handled in
// GDScript; this owns color/glow) plus the "dim everything else" fade
// used during WIN_ANIM. SymbolVisual._ready() duplicates this material
// per-instance so every symbol pulses on ITS OWN clock instead of in
// lockstep — synced pulsing across the whole board is the #1 tell of a
// cheap flash-game win effect.

uniform float pulse_speed : hint_range(0.0, 8.0) = 0.0;
uniform float pulse_strength : hint_range(0.0, 1.0) = 0.0;
uniform vec4 glow_color : source_color = vec4(1.0, 0.85, 0.35, 1.0);
uniform float dim_amount : hint_range(0.0, 1.0) = 0.0;
uniform float outline_width : hint_range(0.0, 4.0) = 1.5;

void fragment() {
	vec4 tex = texture(TEXTURE, UV);
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
