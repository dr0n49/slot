from poker.combinadic import binomial_table, colex_index, colex_unrank
from poker.constants import N_CARDS, N_DEALS


def test_binom_known_values():
    b = binomial_table()
    assert int(b[52, 5]) == N_DEALS
    assert int(b[52, 0]) == 1
    assert int(b[47, 5]) == 1_533_939
    assert int(b[47, 4]) == 178_365
    assert int(b[5, 5]) == 1
    assert int(b[4, 5]) == 0


def test_colex_roundtrip_sample():
    b = binomial_table()
    samples = [
        (0, 1, 2, 3, 4),
        (0, 1, 2, 3, 5),
        (47, 48, 49, 50, 51),
        (0, 10, 20, 30, 40),
        (1, 2, 3, 4, 5),
    ]
    for cards in samples:
        idx = colex_index(cards, 5, b)
        assert colex_unrank(idx, 5, b) == cards


def test_colex_covers_all_5_sets():
    b = binomial_table()
    first = colex_index((0, 1, 2, 3, 4), 5, b)
    last = colex_index((47, 48, 49, 50, 51), 5, b)
    assert first == 0
    assert last == N_DEALS - 1
    assert colex_unrank(0, 5, b) == (0, 1, 2, 3, 4)
    assert colex_unrank(N_DEALS - 1, 5, b) == (47, 48, 49, 50, 51)


def test_colex_k_varies():
    b = binomial_table()
    assert colex_index((7,), 1, b) == 7
    pair = (3, 10)
    idx = colex_index(pair, 2, b)
    assert colex_unrank(idx, 2, b) == pair
    assert int(b[N_CARDS, 4]) == 270_725
