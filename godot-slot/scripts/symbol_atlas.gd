extends Node
## Autoload singleton "SymbolAtlas". Loads every card face used by this deck
## from res://assets/cards/ and serves it back by symbol id ("AS", "TD",
## "JOKER", "JOKER_gold", "card_back").
##
## Why an explicit table instead of scanning the directory at runtime
## (DirAccess.list_dir_begin/get_next): a runtime directory scan depends on
## the res:// virtual filesystem supporting live directory listing, which is
## NOT guaranteed the same way across every export target — the Web/HTML5
## export in particular streams resources out of a packed .pck rather than a
## real folder, and directory listing there has known platform quirks. An
## explicit id -> path table sidesteps all of that: every id below is loaded
## with a plain load(), the same call used for every other resource in this
## project, so it behaves identically in the editor, on desktop and in the
## Web export. It's also just easier to verify by eye: the table IS the
## asset manifest.

const CARD_DIR := "res://assets/cards/"

const RANKS: Array[String] = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]
const SUITS: Array[String] = ["S", "H", "D", "C"]

## Extra faces beyond the 52-card rank+suit grid, with their own extensions
## (card_back ships as .png, everything else in this deck is .webp).
const EXTRA_FACES := {
	"JOKER": "webp",
	"JOKER_gold": "webp",
	"card_back": "png",
}

var _textures: Dictionary = {}

func _ready() -> void:
	for suit in SUITS:
		for rank in RANKS:
			var id := StringName(rank + suit)
			_load_face(id, "webp")
	for face_id in EXTRA_FACES.keys():
		_load_face(StringName(face_id), EXTRA_FACES[face_id])
	# The bonus ("golden") card is the Day-of-the-Dead reaper JOKER — the same
	# art React's jokerFaceUrl() shows (frontend/public/assets/cards_v2/JOKER.webp).
	# JOKER_gold.webp used to be an older jester skull; it is now a copy of the
	# reaper, and the id is aliased here too so no path can show the old art.
	if _textures.has(&"JOKER"):
		_textures[&"JOKER_gold"] = _textures[&"JOKER"]

func _load_face(id: StringName, ext: String) -> void:
	var path := "%s%s.%s" % [CARD_DIR, String(id), ext]
	var tex: Texture2D = load(path)
	if tex == null:
		push_warning("SymbolAtlas: failed to load %s (id %s)" % [path, id])
		return
	_textures[id] = tex

## Manual override/registration — useful in tests or if you want to swap
## a face at runtime without touching the asset table above.
func register(id: StringName, texture: Texture2D) -> void:
	_textures[id] = texture

func texture_for(id: StringName) -> Texture2D:
	return _textures.get(id, _textures.get(&"card_back", null))

## Every loaded id except the card back — handy for a demo/random spin.
func all_ids() -> Array:
	var ids: Array = []
	for id in _textures.keys():
		if id != &"card_back":
			ids.append(id)
	return ids
