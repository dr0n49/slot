"""Card helpers and 5-card Jacks-or-Better category evaluation."""

from .constants import (
    CATEGORY_NAMES,
    Category,
    HIGH_PAIR_RANK,
    N_RANKS,
    PAYTABLE_7_5,
    RANK_CHARS,
    SUIT_CHARS,
)


def card_rank(card: int) -> int:
    return card % 13


def card_suit(card: int) -> int:
    return card // 13


def make_card(rank: int, suit: int) -> int:
    return suit * 13 + rank


def parse_card(text: str) -> int:
    """Parse a card like 'AH', 'Td', '2c'."""
    text = text.strip()
    if len(text) != 2:
        raise ValueError(f"Invalid card: {text!r}")
    rank = RANK_CHARS.index(text[0].upper())
    suit = SUIT_CHARS.index(text[1].upper())
    return make_card(rank, suit)


def parse_hand(text: str) -> tuple[int, ...]:
    """Parse a space-separated 5-card hand, e.g. 'AH KH QH JH TH'."""
    cards = tuple(parse_card(tok) for tok in text.split())
    if len(cards) != 5:
        raise ValueError(f"Expected 5 cards, got {len(cards)}: {text!r}")
    if len(set(cards)) != 5:
        raise ValueError(f"Duplicate cards in hand: {text!r}")
    return cards


def card_str(card: int) -> str:
    return f"{RANK_CHARS[card_rank(card)]}{SUIT_CHARS[card_suit(card)]}"


def hand_str(cards) -> str:
    return " ".join(card_str(c) for c in cards)


def evaluate_category(cards) -> Category:
    """Return the JoB category of a 5-card hand. Cards are ints 0..51."""
    r0, r1, r2, r3, r4 = (
        cards[0] % 13,
        cards[1] % 13,
        cards[2] % 13,
        cards[3] % 13,
        cards[4] % 13,
    )
    s0, s1, s2, s3, s4 = (
        cards[0] // 13,
        cards[1] // 13,
        cards[2] // 13,
        cards[3] // 13,
        cards[4] // 13,
    )
    is_flush = s0 == s1 == s2 == s3 == s4

    counts = [0] * N_RANKS
    counts[r0] += 1
    counts[r1] += 1
    counts[r2] += 1
    counts[r3] += 1
    counts[r4] += 1

    cmax = 0
    csecond = 0
    n_unique = 0
    pair_rank = -1
    for rank in range(N_RANKS):
        c = counts[rank]
        if c:
            n_unique += 1
            if c > cmax:
                csecond = cmax
                cmax = c
            elif c > csecond:
                csecond = c
            if c == 2:
                pair_rank = rank

    is_straight = False
    if n_unique == 5:
        mn = 12
        mx = 0
        for rank in range(N_RANKS):
            if counts[rank]:
                if rank < mn:
                    mn = rank
                if rank > mx:
                    mx = rank
        if mx - mn == 4:
            is_straight = True
        elif (
            counts[12]
            and counts[0]
            and counts[1]
            and counts[2]
            and counts[3]
        ):
            is_straight = True  # wheel A-2-3-4-5

    is_royal = bool(
        is_flush
        and is_straight
        and counts[8]
        and counts[9]
        and counts[10]
        and counts[11]
        and counts[12]
    )

    if is_royal:
        return Category.ROYAL_FLUSH
    if is_flush and is_straight:
        return Category.STRAIGHT_FLUSH
    if cmax == 4:
        return Category.FOUR_OF_A_KIND
    if cmax == 3 and csecond == 2:
        return Category.FULL_HOUSE
    if is_flush:
        return Category.FLUSH
    if is_straight:
        return Category.STRAIGHT
    if cmax == 3:
        return Category.THREE_OF_A_KIND
    if cmax == 2 and csecond == 2:
        return Category.TWO_PAIR
    if cmax == 2 and pair_rank >= HIGH_PAIR_RANK:
        return Category.JACKS_OR_BETTER
    return Category.NOTHING


def payout(cards, paytable=PAYTABLE_7_5) -> int:
    return paytable[evaluate_category(cards)]


def category_name(cat: Category) -> str:
    return CATEGORY_NAMES[cat]
