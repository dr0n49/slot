import type { BookEvent } from '../../game/typesBookEvent';
import holdEvents from './mocked_hold_events';

/** MOCKED double-up sequences. Not taken from generated LUT / publish_files. */
const job = holdEvents.jacksOrBetter as BookEvent[];
const royal = holdEvents.royalFlush as BookEvent[];
const nothing = holdEvents.nothing as BookEvent[];

const missStage1: BookEvent = {
	index: 4,
	type: 'doubleUp',
	step: 1,
	card: '4H',
	colour: 'red',
	correct: false,
	amountAfter: 0,
};

const surviveStage1: BookEvent = {
	index: 4,
	type: 'doubleUp',
	step: 1,
	card: '7D',
	colour: 'red',
	correct: true,
	amountAfter: 160000,
};

const surviveStage2: BookEvent = {
	index: 5,
	type: 'doubleUp',
	step: 2,
	card: 'KS',
	colour: 'black',
	correct: true,
	amountAfter: 320000,
};

const royalHandResult = royal[royal.length - 1];

const events: Record<string, BookEvent | BookEvent[]> = {
	doubleUp: surviveStage1,
	handResultThenDoubleUp: [royalHandResult, surviveStage1],
	none: nothing,
	missStage1: [...job, missStage1],
	surviveBoth: [...royal, surviveStage1, surviveStage2],
};

export default events;
