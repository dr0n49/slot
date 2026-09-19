import type { BookEvent } from '../../game/typesBookEvent';

/** MOCKED book-event sequences. Not taken from generated LUT / publish_files. */
const cards = (...codes: string[]) => codes.map((card) => ({ card }));

const deal = {
	index: 0,
	type: 'deal' as const,
	cards: cards('JC', 'JD', '4H', '9S', '2C'),
};

const hold = {
	index: 1,
	type: 'hold' as const,
	holdMask: 3,
	held: cards('JC', 'JD'),
};

const draw = {
	index: 2,
	type: 'draw' as const,
	drawn: cards('8D', 'KH', '7C'),
	finalHand: cards('JC', 'JD', '8D', 'KH', '7C'),
};

const handResult = {
	index: 3,
	type: 'handResult' as const,
	category: 'Jacks or Better',
	amount: 100,
};

const events: Record<string, BookEvent | BookEvent[]> = {
	deal,
	hold,
	draw,
	handResult,
	holdWithDeal: [deal, hold],
	jacksOrBetter: [
		deal,
		hold,
		draw,
		handResult,
	],
	fullHouse: [
		{ index: 0, type: 'deal', cards: cards('AH', 'AD', 'KS', 'KH', '9C') },
		{ index: 1, type: 'hold', holdMask: 15, held: cards('AH', 'AD', 'KS', 'KH') },
		{
			index: 2,
			type: 'draw',
			drawn: cards('AC'),
			finalHand: cards('AH', 'AD', 'KS', 'KH', 'AC'),
		},
		{ index: 3, type: 'handResult', category: 'Full House', amount: 700 },
	],
	royalFlush: [
		{ index: 0, type: 'deal', cards: cards('AH', 'KH', 'QH', 'JH', 'TH') },
		{
			index: 1,
			type: 'hold',
			holdMask: 31,
			held: cards('AH', 'KH', 'QH', 'JH', 'TH'),
		},
		{
			index: 2,
			type: 'draw',
			drawn: [],
			finalHand: cards('AH', 'KH', 'QH', 'JH', 'TH'),
		},
		{ index: 3, type: 'handResult', category: 'Royal Flush', amount: 80000 },
	],
	nothing: [
		{ index: 0, type: 'deal', cards: cards('QH', 'JC', '9D', '6S', '2H') },
		{ index: 1, type: 'hold', holdMask: 3, held: cards('QH', 'JC') },
		{
			index: 2,
			type: 'draw',
			drawn: cards('8C', '5D', '3S'),
			finalHand: cards('QH', 'JC', '8C', '5D', '3S'),
		},
		{ index: 3, type: 'handResult', category: 'Nothing', amount: 0 },
	],
	discardAll: [
		{ index: 0, type: 'deal', cards: cards('2C', '7D', '9H', '4S', '8C') },
		{ index: 1, type: 'hold', holdMask: 0, held: [] },
		{
			index: 2,
			type: 'draw',
			drawn: cards('AS', 'AD', 'AH', 'KC', '2D'),
			finalHand: cards('AS', 'AD', 'AH', 'KC', '2D'),
		},
		{ index: 3, type: 'handResult', category: 'Three of a Kind', amount: 300 },
	],
};

export default events;
