<script lang="ts">
	import { fade } from 'svelte/transition';
	import { onDestroy, onMount } from 'svelte';
	import { EnableHotkey } from 'components-shared';
	import { GameVersion, Modals } from 'components-ui-html';
	import { stateBet, stateModal } from 'state-shared';

	import { assetUrl } from '../game/assets';
	import { describeError } from '../game/errors';
	import { getContext } from '../game/context';
	import { Scene, setScene } from '../game/engine/scene';
	import { requestSkip, syncTiming } from '../game/presentation';
	import { recoverFromError } from '../game/roundFlow';
	import { sfx } from '../game/sfx';
	import { stateGame } from '../game/stateGame.svelte';
	import { stageLayout, uiState } from '../game/uiState.svelte';
	import EnableGameActor from './EnableGameActor.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import Hud from './hud/Hud.svelte';
	import TopBar from './hud/TopBar.svelte';
	import LadderPanel from './LadderPanel.svelte';
	import Banner from './overlays/Banner.svelte';
	import BigWin from './overlays/BigWin.svelte';
	import BuyBonusDialog from './overlays/BuyBonusDialog.svelte';
	import ErrorDialog from './overlays/ErrorDialog.svelte';
	import FeatureOverlay from './overlays/FeatureOverlay.svelte';
	import InfoDialog from './overlays/InfoDialog.svelte';
	import Popups from './overlays/Popups.svelte';
	import RightRail from './overlays/RightRail.svelte';

	import './hud/theme.css';

	const context = getContext();

	let host: HTMLDivElement | undefined = $state();
	let scene: Scene | null = null;
	let loadProgress = $state(0);

	const L = $derived(stageLayout());
	const busy = $derived(stateGame.phase !== 'IDLE');
	const overlayOpen = $derived(
		Boolean(stateGame.bigWin || stateGame.featureIntro || stateGame.featureOutro || uiState.infoOpen || uiState.buyOpen),
	);

	/** Fonts are self-hosted (the Typekit stylesheet is blocked by the Stake CSP). */
	const loadFonts = async () => {
		const faces = [
			['Anton', 'assets/fonts/anton.woff2', '400'],
			['Rubik', 'assets/fonts/rubik-400.woff2', '400'],
			['Rubik', 'assets/fonts/rubik-500.woff2', '500'],
			['Rubik', 'assets/fonts/rubik-700.woff2', '700'],
			['Oswald', 'assets/fonts/oswald-500.woff2', '500'],
			['Oswald', 'assets/fonts/oswald-600.woff2', '600'],
			['Oswald', 'assets/fonts/oswald-700.woff2', '700'],
			['Pirata One', 'assets/fonts/pirata-one.woff2', '400'],
			['proxima-nova', 'assets/fonts/rubik-400.woff2', '400'],
			['proxima-nova', 'assets/fonts/rubik-700.woff2', '700'],
		] as const;
		await Promise.race([
			Promise.all(
				faces.map(async ([family, path, weight]) => {
					try {
						const face = new FontFace(family, `url(${assetUrl(path)}) format('woff2')`, { weight });
						document.fonts.add(await face.load());
					} catch (error) {
						console.warn(`font ${family} ${weight} failed to load`, error);
					}
				}),
			),
			new Promise((resolve) => setTimeout(resolve, 3500)),
		]);
	};

	onMount(() => {
		let cancelled = false;
		sfx.enableBgm();
		void (async () => {
			try {
				await loadFonts();
				if (cancelled || !host) return;
				scene = await Scene.create(host, (p) => (loadProgress = p));
				if (cancelled) return scene.destroy();
				setScene(scene);
				(window as unknown as { __nitro?: unknown }).__nitro = debugHandle();
				stateGame.sceneReady = true;
				context.stateLayout.showLoadingScreen = false;
			} catch (error) {
				console.error(error);
				context.stateLayout.showLoadingScreen = false;
				stateModal.modal = {
					name: 'error',
					error: { error: 'GRAPHICS', message: 'The game could not start (graphics or asset loading failed).' },
				};
			}
		})();
		return () => {
			cancelled = true;
			sfx.disableBgm();
		};
	});

	onDestroy(() => {
		scene?.destroy();
		setScene(null);
	});

	/** Read-only diagnostics for automated tests; only exposed in dev builds or with ?e2e=1. */
	const debugHandle = () => {
		const enabled = import.meta.env.DEV || new URLSearchParams(location.search).has('e2e');
		if (!enabled) return undefined;
		return {
			state: stateGame,
			board: () => scene?.board.names.map((c) => c.slice(1, 7)),
			particles: () => scene?.boardParticles.count,
			layout: () => scene?.layout,
			scene: () => scene,
			advance: (ms: number, step?: number) => scene?.advance(ms, step),
		};
	};

	$effect(() => {
		void stateBet.isTurbo;
		syncTiming();
	});

	// The engine reports RGS / network failures through its stock error modal, which prints raw
	// payloads. Swap it for the game's own dialog and make sure the reels never keep spinning.
	$effect(() => {
		const modal = stateModal.modal;
		if (modal?.name !== 'error') return;
		const friendly = describeError(modal.error);
		stateModal.modal = null;
		if (stateGame.phase !== 'IDLE') recoverFromError(friendly.message);
		stateGame.error = { title: friendly.title, message: friendly.message };
	});
</script>

<div
	class="game-root"
	bind:clientWidth={uiState.viewportW}
	bind:clientHeight={uiState.viewportH}
	class:portrait={L.portrait}
>
	<div class="canvas-host" bind:this={host} aria-hidden="true"></div>

	<div
		class="nv-stage stage"
		class:portrait={L.portrait}
		style="width: {L.stageW}px; height: {L.stageH}px; transform: scale({L.scale});"
	>
		<TopBar height={L.topH} portrait={L.portrait} />
		<LadderPanel
			portrait={L.portrait}
			width={L.railW}
			top={L.portrait ? 60 : L.board.y}
			height={L.portrait ? 50 : L.board.h}
		/>
		{#if !L.portrait}
			<RightRail right={12} width={L.railW - 24} top={L.board.y} height={L.board.h} />
		{/if}

		{#if busy && !overlayOpen}
			<button type="button" class="skip" aria-label="Skip animation" tabindex="-1" onclick={requestSkip}></button>
		{/if}

		<Popups />
		<Banner top={L.board.y + L.board.h / 2} />
		<Hud height={L.bottomH} />

		<FeatureOverlay />
		<BigWin />
		<BuyBonusDialog />
		<InfoDialog />

		<ErrorDialog />
	</div>

	{#if !stateGame.sceneReady}
		<div
			class="loading"
			role="progressbar"
			aria-label="Loading"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={Math.round(loadProgress * 100)}
			out:fade={{ duration: 450 }}
		>
			<div class="brand"><span class="n">NITRO</span><span class="v">VEIN</span></div>
			<div class="bar"><i style="width: {Math.max(4, Math.round(loadProgress * 100))}%"></i></div>
			<div class="hint">DIGGING DEEPER…</div>
		</div>
	{/if}

	{#if stateGame.sceneReady}
		<EnableGameActor />
		<ResumeBet />
	{/if}
	<EnableHotkey />

	<Modals>
		{#snippet version()}
			<GameVersion version="1.0.0" />
		{/snippet}
	</Modals>
</div>

<style>
	.game-root {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #0b0710;
		overscroll-behavior: none;
		touch-action: manipulation;
	}
	:global(html),
	:global(body) {
		height: 100%;
		max-height: 100%;
		margin: 0;
		padding: 0;
		overflow: hidden;
		overscroll-behavior: none;
	}
	:global(body > div) {
		height: 100%;
		max-height: 100%;
		overflow: hidden;
	}
	.canvas-host {
		position: absolute;
		inset: 0;
	}
	.stage {
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: top left;
		pointer-events: none;
	}
	.stage :global(button),
	.stage :global([role='button']),
	.stage :global([role='dialog']),
	.stage :global(.scrim),
	.stage :global(.bw),
	.stage :global(.fo) {
		pointer-events: auto;
	}
	.skip {
		position: absolute;
		inset: 0;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		z-index: 13;
	}
	.loading {
		position: absolute;
		inset: 0;
		z-index: 60;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 22px;
		background:
			radial-gradient(ellipse at 50% 40%, rgba(255, 106, 26, 0.22), transparent 60%),
			linear-gradient(180deg, #1a0f26 0%, #07040c 100%);
	}
	.brand {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-family: var(--nv-font-display, 'Anton', Impact, sans-serif);
		font-size: clamp(44px, 12vmin, 96px);
		line-height: 0.95;
		letter-spacing: 0.06em;
	}
	.brand .n {
		background: linear-gradient(180deg, #fff2b0, #ffc107 60%, #b36a00);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.8));
	}
	.brand .v {
		background: linear-gradient(180deg, #ffb27a, #ff6a1a 60%, #a12a05);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.8)) drop-shadow(0 0 18px rgba(255, 106, 26, 0.6));
	}
	.bar {
		width: min(60%, 340px);
		height: 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		overflow: hidden;
	}
	.bar i {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #ff6a1a, #ffd54a);
		transition: width 0.2s ease;
	}
	.hint {
		font-family: var(--nv-font-ui, sans-serif);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.3em;
		color: rgba(255, 213, 74, 0.75);
	}
</style>
