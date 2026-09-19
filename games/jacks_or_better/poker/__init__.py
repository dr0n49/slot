"""Jacks-or-Better exact combinatorial engine."""

from .constants import (
    CATEGORY_NAMES,
    PAYTABLE_7_5,
    Category,
    DOUBLE_UP_MAX_CHAIN,
)
from .evaluator import evaluate_category, parse_hand, payout
from .solver import EnumerationResult, enumerate_optimal
from .double_up import CombinedResult, combine_with_double_up

__all__ = [
    "CATEGORY_NAMES",
    "PAYTABLE_7_5",
    "Category",
    "DOUBLE_UP_MAX_CHAIN",
    "evaluate_category",
    "parse_hand",
    "payout",
    "EnumerationResult",
    "enumerate_optimal",
    "CombinedResult",
    "combine_with_double_up",
]
