export type CardCode = string;

export type CardPayload = { card: CardCode };

export type ParsedCard = {
	code: CardCode;
	rank: string;
	suit: string;
	colour: 'red' | 'black';
};
