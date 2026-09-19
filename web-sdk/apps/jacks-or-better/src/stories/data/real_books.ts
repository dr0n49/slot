import type { BookEvent } from '../../game/typesBookEvent';

/** REAL generated books from library/publish_files/books_base.jsonl.zst — not mocked. */
export type RealBook = {
	id: number;
	payoutMultiplier: number;
	events: BookEvent[];
};

export const loss: RealBook = {
  "id": 786,
  "payoutMultiplier": 0,
  "events": [
    {
      "index": 0,
      "type": "deal",
      "cards": [
        {
          "card": "4C"
        },
        {
          "card": "TC"
        },
        {
          "card": "JC"
        },
        {
          "card": "QC"
        },
        {
          "card": "KC"
        }
      ]
    },
    {
      "index": 1,
      "type": "hold",
      "holdMask": 30,
      "held": [
        {
          "card": "TC"
        },
        {
          "card": "JC"
        },
        {
          "card": "QC"
        },
        {
          "card": "KC"
        }
      ]
    },
    {
      "index": 2,
      "type": "draw",
      "drawn": [
        {
          "card": "2S"
        }
      ],
      "finalHand": [
        {
          "card": "TC"
        },
        {
          "card": "JC"
        },
        {
          "card": "QC"
        },
        {
          "card": "KC"
        },
        {
          "card": "2S"
        }
      ]
    },
    {
      "index": 3,
      "type": "handResult",
      "category": "Nothing",
      "amount": 0
    },
    {
      "index": 4,
      "type": "setTotalWin",
      "amount": 0
    },
    {
      "index": 5,
      "type": "finalWin",
      "amount": 0
    }
  ]
} as RealBook;

export const missStage1: RealBook = {
  "id": 784,
  "payoutMultiplier": 0,
  "events": [
    {
      "index": 0,
      "type": "deal",
      "cards": [
        {
          "card": "2C"
        },
        {
          "card": "TC"
        },
        {
          "card": "JC"
        },
        {
          "card": "QC"
        },
        {
          "card": "KC"
        }
      ]
    },
    {
      "index": 1,
      "type": "hold",
      "holdMask": 30,
      "held": [
        {
          "card": "TC"
        },
        {
          "card": "JC"
        },
        {
          "card": "QC"
        },
        {
          "card": "KC"
        }
      ]
    },
    {
      "index": 2,
      "type": "draw",
      "drawn": [
        {
          "card": "KH"
        }
      ],
      "finalHand": [
        {
          "card": "TC"
        },
        {
          "card": "JC"
        },
        {
          "card": "QC"
        },
        {
          "card": "KC"
        },
        {
          "card": "KH"
        }
      ]
    },
    {
      "index": 3,
      "type": "handResult",
      "category": "Jacks or Better",
      "amount": 100
    },
    {
      "index": 4,
      "type": "doubleUp",
      "step": 1,
      "card": "3S",
      "colour": "black",
      "correct": false,
      "amountAfter": 0
    },
    {
      "index": 5,
      "type": "setTotalWin",
      "amount": 0
    },
    {
      "index": 6,
      "type": "finalWin",
      "amount": 0
    }
  ]
} as RealBook;

export const surviveBoth: RealBook = {
  "id": 1,
  "payoutMultiplier": 2000,
  "events": [
    {
      "index": 0,
      "type": "deal",
      "cards": [
        {
          "card": "2C"
        },
        {
          "card": "3C"
        },
        {
          "card": "4C"
        },
        {
          "card": "5C"
        },
        {
          "card": "7C"
        }
      ]
    },
    {
      "index": 1,
      "type": "hold",
      "holdMask": 31,
      "held": [
        {
          "card": "2C"
        },
        {
          "card": "3C"
        },
        {
          "card": "4C"
        },
        {
          "card": "5C"
        },
        {
          "card": "7C"
        }
      ]
    },
    {
      "index": 2,
      "type": "draw",
      "drawn": [],
      "finalHand": [
        {
          "card": "2C"
        },
        {
          "card": "3C"
        },
        {
          "card": "4C"
        },
        {
          "card": "5C"
        },
        {
          "card": "7C"
        }
      ]
    },
    {
      "index": 3,
      "type": "handResult",
      "category": "Flush",
      "amount": 500
    },
    {
      "index": 4,
      "type": "doubleUp",
      "step": 1,
      "card": "2D",
      "colour": "red",
      "correct": true,
      "amountAfter": 1000
    },
    {
      "index": 5,
      "type": "doubleUp",
      "step": 2,
      "card": "QS",
      "colour": "black",
      "correct": true,
      "amountAfter": 2000
    },
    {
      "index": 6,
      "type": "setTotalWin",
      "amount": 2000
    },
    {
      "index": 7,
      "type": "finalWin",
      "amount": 2000
    }
  ]
} as RealBook;

export const royal3200: RealBook = {
  "id": 6682,
  "payoutMultiplier": 320000,
  "events": [
    {
      "index": 0,
      "type": "deal",
      "cards": [
        {
          "card": "TC"
        },
        {
          "card": "JC"
        },
        {
          "card": "QC"
        },
        {
          "card": "KC"
        },
        {
          "card": "6D"
        }
      ]
    },
    {
      "index": 1,
      "type": "hold",
      "holdMask": 15,
      "held": [
        {
          "card": "TC"
        },
        {
          "card": "JC"
        },
        {
          "card": "QC"
        },
        {
          "card": "KC"
        }
      ]
    },
    {
      "index": 2,
      "type": "draw",
      "drawn": [
        {
          "card": "AC"
        }
      ],
      "finalHand": [
        {
          "card": "TC"
        },
        {
          "card": "JC"
        },
        {
          "card": "QC"
        },
        {
          "card": "KC"
        },
        {
          "card": "AC"
        }
      ]
    },
    {
      "index": 3,
      "type": "handResult",
      "category": "Royal Flush",
      "amount": 80000
    },
    {
      "index": 4,
      "type": "doubleUp",
      "step": 1,
      "card": "9H",
      "colour": "red",
      "correct": true,
      "amountAfter": 160000
    },
    {
      "index": 5,
      "type": "doubleUp",
      "step": 2,
      "card": "6H",
      "colour": "red",
      "correct": true,
      "amountAfter": 320000
    },
    {
      "index": 6,
      "type": "setTotalWin",
      "amount": 320000
    },
    {
      "index": 7,
      "type": "finalWin",
      "amount": 320000
    }
  ]
} as RealBook;

export const extras: RealBook[] = [
  {
    "id": 2,
    "payoutMultiplier": 2000,
    "events": [
      {
        "index": 0,
        "type": "deal",
        "cards": [
          {
            "card": "2C"
          },
          {
            "card": "3C"
          },
          {
            "card": "4C"
          },
          {
            "card": "6C"
          },
          {
            "card": "7C"
          }
        ]
      },
      {
        "index": 1,
        "type": "hold",
        "holdMask": 31,
        "held": [
          {
            "card": "2C"
          },
          {
            "card": "3C"
          },
          {
            "card": "4C"
          },
          {
            "card": "6C"
          },
          {
            "card": "7C"
          }
        ]
      },
      {
        "index": 2,
        "type": "draw",
        "drawn": [],
        "finalHand": [
          {
            "card": "2C"
          },
          {
            "card": "3C"
          },
          {
            "card": "4C"
          },
          {
            "card": "6C"
          },
          {
            "card": "7C"
          }
        ]
      },
      {
        "index": 3,
        "type": "handResult",
        "category": "Flush",
        "amount": 500
      },
      {
        "index": 4,
        "type": "doubleUp",
        "step": 1,
        "card": "JH",
        "colour": "red",
        "correct": true,
        "amountAfter": 1000
      },
      {
        "index": 5,
        "type": "doubleUp",
        "step": 2,
        "card": "AH",
        "colour": "red",
        "correct": true,
        "amountAfter": 2000
      },
      {
        "index": 6,
        "type": "setTotalWin",
        "amount": 2000
      },
      {
        "index": 7,
        "type": "finalWin",
        "amount": 2000
      }
    ]
  },
  {
    "id": 3,
    "payoutMultiplier": 2000,
    "events": [
      {
        "index": 0,
        "type": "deal",
        "cards": [
          {
            "card": "2C"
          },
          {
            "card": "3C"
          },
          {
            "card": "5C"
          },
          {
            "card": "6C"
          },
          {
            "card": "7C"
          }
        ]
      },
      {
        "index": 1,
        "type": "hold",
        "holdMask": 31,
        "held": [
          {
            "card": "2C"
          },
          {
            "card": "3C"
          },
          {
            "card": "5C"
          },
          {
            "card": "6C"
          },
          {
            "card": "7C"
          }
        ]
      },
      {
        "index": 2,
        "type": "draw",
        "drawn": [],
        "finalHand": [
          {
            "card": "2C"
          },
          {
            "card": "3C"
          },
          {
            "card": "5C"
          },
          {
            "card": "6C"
          },
          {
            "card": "7C"
          }
        ]
      },
      {
        "index": 3,
        "type": "handResult",
        "category": "Flush",
        "amount": 500
      },
      {
        "index": 4,
        "type": "doubleUp",
        "step": 1,
        "card": "2H",
        "colour": "red",
        "correct": true,
        "amountAfter": 1000
      },
      {
        "index": 5,
        "type": "doubleUp",
        "step": 2,
        "card": "2C",
        "colour": "black",
        "correct": true,
        "amountAfter": 2000
      },
      {
        "index": 6,
        "type": "setTotalWin",
        "amount": 2000
      },
      {
        "index": 7,
        "type": "finalWin",
        "amount": 2000
      }
    ]
  },
  {
    "id": 10,
    "payoutMultiplier": 0,
    "events": [
      {
        "index": 0,
        "type": "deal",
        "cards": [
          {
            "card": "3C"
          },
          {
            "card": "4C"
          },
          {
            "card": "5C"
          },
          {
            "card": "6C"
          },
          {
            "card": "8C"
          }
        ]
      },
      {
        "index": 1,
        "type": "hold",
        "holdMask": 31,
        "held": [
          {
            "card": "3C"
          },
          {
            "card": "4C"
          },
          {
            "card": "5C"
          },
          {
            "card": "6C"
          },
          {
            "card": "8C"
          }
        ]
      },
      {
        "index": 2,
        "type": "draw",
        "drawn": [],
        "finalHand": [
          {
            "card": "3C"
          },
          {
            "card": "4C"
          },
          {
            "card": "5C"
          },
          {
            "card": "6C"
          },
          {
            "card": "8C"
          }
        ]
      },
      {
        "index": 3,
        "type": "handResult",
        "category": "Flush",
        "amount": 500
      },
      {
        "index": 4,
        "type": "doubleUp",
        "step": 1,
        "card": "TH",
        "colour": "red",
        "correct": false,
        "amountAfter": 0
      },
      {
        "index": 5,
        "type": "setTotalWin",
        "amount": 0
      },
      {
        "index": 6,
        "type": "finalWin",
        "amount": 0
      }
    ]
  },
  {
    "id": 20,
    "payoutMultiplier": 20000,
    "events": [
      {
        "index": 0,
        "type": "deal",
        "cards": [
          {
            "card": "4C"
          },
          {
            "card": "5C"
          },
          {
            "card": "6C"
          },
          {
            "card": "7C"
          },
          {
            "card": "8C"
          }
        ]
      },
      {
        "index": 1,
        "type": "hold",
        "holdMask": 31,
        "held": [
          {
            "card": "4C"
          },
          {
            "card": "5C"
          },
          {
            "card": "6C"
          },
          {
            "card": "7C"
          },
          {
            "card": "8C"
          }
        ]
      },
      {
        "index": 2,
        "type": "draw",
        "drawn": [],
        "finalHand": [
          {
            "card": "4C"
          },
          {
            "card": "5C"
          },
          {
            "card": "6C"
          },
          {
            "card": "7C"
          },
          {
            "card": "8C"
          }
        ]
      },
      {
        "index": 3,
        "type": "handResult",
        "category": "Straight Flush",
        "amount": 5000
      },
      {
        "index": 4,
        "type": "doubleUp",
        "step": 1,
        "card": "4D",
        "colour": "red",
        "correct": true,
        "amountAfter": 10000
      },
      {
        "index": 5,
        "type": "doubleUp",
        "step": 2,
        "card": "3C",
        "colour": "black",
        "correct": true,
        "amountAfter": 20000
      },
      {
        "index": 6,
        "type": "setTotalWin",
        "amount": 20000
      },
      {
        "index": 7,
        "type": "finalWin",
        "amount": 20000
      }
    ]
  },
  {
    "id": 50,
    "payoutMultiplier": 0,
    "events": [
      {
        "index": 0,
        "type": "deal",
        "cards": [
          {
            "card": "3C"
          },
          {
            "card": "5C"
          },
          {
            "card": "7C"
          },
          {
            "card": "8C"
          },
          {
            "card": "9C"
          }
        ]
      },
      {
        "index": 1,
        "type": "hold",
        "holdMask": 31,
        "held": [
          {
            "card": "3C"
          },
          {
            "card": "5C"
          },
          {
            "card": "7C"
          },
          {
            "card": "8C"
          },
          {
            "card": "9C"
          }
        ]
      },
      {
        "index": 2,
        "type": "draw",
        "drawn": [],
        "finalHand": [
          {
            "card": "3C"
          },
          {
            "card": "5C"
          },
          {
            "card": "7C"
          },
          {
            "card": "8C"
          },
          {
            "card": "9C"
          }
        ]
      },
      {
        "index": 3,
        "type": "handResult",
        "category": "Flush",
        "amount": 500
      },
      {
        "index": 4,
        "type": "doubleUp",
        "step": 1,
        "card": "JC",
        "colour": "black",
        "correct": false,
        "amountAfter": 0
      },
      {
        "index": 5,
        "type": "setTotalWin",
        "amount": 0
      },
      {
        "index": 6,
        "type": "finalWin",
        "amount": 0
      }
    ]
  }
] as RealBook[];

export const realBookList: RealBook[] = [loss, missStage1, surviveBoth, royal3200, ...extras];
