shader_type canvas_item;

// Directional smear applied to a single symbol Sprite2D while its reel is
// at full spin speed. Deliberately cheap: N extra samples of THIS
// sprite's own texture, no screen-texture read — safe to run on all 25
// on-screen symbols simultaneously (5x5 grid) without a compositor pass
// or a drop in frame time. Driven from SymbolVisual.play_blur().

uniform float blur_amount : hint_range(0.0, 1.0) = 0.0;
uniform float blur_reach : hint_range(0.0, 0.25) = 0.09; // in UV units
uniform int samples : hint_range(3, 12) = 7;

void fragment() {
	if (blur_amount <= 0.001) {
		COLOR = texture(TEXTURE, UV);
		return;
	}

	vec4 accum = vec4(0.0);
	float total_weight = 0.0;
	float reach = blur_reach * blur_amount;

	for (int i = 0; i < samples; i++) {
		float t = float(i) / float(samples - 1) - 0.5; // -0.5 .. 0.5
		float weight = max(1.0 - abs(t) * 1.4, 0.0);
		vec2 sample_uv = UV + vec2(0.0, t * reach);
		if (sample_uv.y >= 0.0 && sample_uv.y <= 1.0) {
			accum += texture(TEXTURE, sample_uv) * weight;
			total_weight += weight;
		}
	}

	vec4 blurred = accum / max(total_weight, 0.001);
	// Slight alpha fade at full blur sells "moving too fast to focus on".
	blurred.a *= mix(1.0, 0.85, blur_amount);
	COLOR = blurred;
}
