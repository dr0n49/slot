export default {
	providerName: 'sample_provider',
	gameName: 'jacks_or_better',
	gameID: 'jacks_or_better',
	rtp: 0.9614720948861089,
	betModes: {
		base: {
			cost: 1.0,
			feature: true,
			buyBonus: false,
			rtp: 0.9614720948861089,
			max_win: 800,
		},
		bonus_job: {
			cost: 2.0,
			feature: false,
			buyBonus: true,
			rtp: 0.9614720948861089,
			max_win: 800,
		},
		bonus_flush: {
			cost: 10.0,
			feature: false,
			buyBonus: true,
			rtp: 0.9614720948861089,
			max_win: 800,
		},
	},
};
