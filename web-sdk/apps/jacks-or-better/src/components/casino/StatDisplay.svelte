<script lang="ts">
	type Props = {
		label: string;
		value: string;
		align?: 'left' | 'right';
	};

	const props: Props = $props();
</script>

<div class="stat" class:left={props.align === 'left'} class:right={props.align === 'right'}>
	<span class="line">
		<span class="label">{props.label}</span>
		<span class="value">{props.value}</span>
	</span>
</div>

<style>
	.stat {
		min-width: 100px;
	}
	.stat.left {
		text-align: left;
	}
	.stat.right {
		text-align: right;
	}
	.line {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
	}
	.label,
	.value {
		font-family: 'Arial Black', Impact, sans-serif;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		-webkit-text-stroke: 1px #7a1a00;
		paint-order: stroke fill;
		text-shadow:
			0 0 0 #000,
			1px 1px 0 #000,
			-1px -1px 0 #000,
			2px 2px 0 rgba(0, 0, 0, 0.8);
	}
	.label {
		color: #ff9800;
		font-size: 18px;
	}
	.value {
		color: #ffb300;
		font-size: 32px;
		line-height: 1;
	}
	:global(.casino-machine.portrait) .stat {
		min-width: 0;
	}
	:global(.casino-machine.portrait) .label {
		font-size: 14px;
	}
	:global(.casino-machine.portrait) .value {
		font-size: 24px;
	}
</style>
