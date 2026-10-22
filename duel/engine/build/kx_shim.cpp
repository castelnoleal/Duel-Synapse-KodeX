// Duel Synapse: KodeX — WebAssembly bridge for edo9300/ygopro-core (AGPL-3.0-or-later).
// Exposes a flat C API so JavaScript never has to lay out OCG_* structs, and
// routes the core's card/script/log callbacks to JavaScript imports.
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include "ocgapi.h"

#define KX_EXPORT(name) extern "C" __attribute__((export_name(#name)))
#define KX_IMPORT(name) __attribute__((import_module("kx"), import_name(#name)))

extern "C" {
KX_IMPORT(card_reader) void js_card_reader(uint32_t code, OCG_CardData* data);
KX_IMPORT(script_reader) int js_script_reader(OCG_Duel duel, const char* name);
KX_IMPORT(log_handler) void js_log_handler(const char* text, int type);
}

static void card_reader(void*, uint32_t code, OCG_CardData* data) {
	std::memset(data, 0, sizeof(OCG_CardData));
	data->code = code;
	js_card_reader(code, data);
}
static void card_reader_done(void*, OCG_CardData* data) {
	if(data->setcodes) std::free(data->setcodes);
	data->setcodes = nullptr;
}
static int script_reader(void*, OCG_Duel duel, const char* name) {
	return js_script_reader(duel, name);
}
static void log_handler(void*, const char* text, int type) {
	js_log_handler(text, type);
}

KX_EXPORT(kx_malloc) void* kx_malloc(uint32_t size) { return std::malloc(size); }
KX_EXPORT(kx_free) void kx_free(void* p) { std::free(p); }
KX_EXPORT(kx_version) int kx_version() {
	int major = 0, minor = 0;
	OCG_GetVersion(&major, &minor);
	return major * 1000 + minor;
}
KX_EXPORT(kx_card_data_size) uint32_t kx_card_data_size() { return sizeof(OCG_CardData); }

KX_EXPORT(kx_create_duel) OCG_Duel kx_create_duel(const uint64_t* seed, uint64_t flags,
	uint32_t lp1, uint32_t start1, uint32_t draw1,
	uint32_t lp2, uint32_t start2, uint32_t draw2) {
	OCG_DuelOptions opt{};
	for(int i = 0; i < 4; ++i) opt.seed[i] = seed[i];
	opt.flags = flags;
	opt.team1 = { lp1, start1, draw1 };
	opt.team2 = { lp2, start2, draw2 };
	opt.cardReader = card_reader;
	opt.scriptReader = script_reader;
	opt.logHandler = log_handler;
	opt.cardReaderDone = card_reader_done;
	opt.enableUnsafeLibraries = 0;
	OCG_Duel duel = nullptr;
	if(OCG_CreateDuel(&duel, &opt) != OCG_DUEL_CREATION_SUCCESS) return nullptr;
	return duel;
}
KX_EXPORT(kx_destroy_duel) void kx_destroy_duel(OCG_Duel duel) { OCG_DestroyDuel(duel); }
KX_EXPORT(kx_new_card) void kx_new_card(OCG_Duel duel, uint32_t team, uint32_t duelist, uint32_t code,
	uint32_t con, uint32_t loc, uint32_t seq, uint32_t pos) {
	OCG_NewCardInfo info{};
	info.team = static_cast<uint8_t>(team);
	info.duelist = static_cast<uint8_t>(duelist);
	info.code = code;
	info.con = static_cast<uint8_t>(con);
	info.loc = loc;
	info.seq = seq;
	info.pos = pos;
	OCG_DuelNewCard(duel, &info);
}
KX_EXPORT(kx_start_duel) void kx_start_duel(OCG_Duel duel) { OCG_StartDuel(duel); }
KX_EXPORT(kx_process) int kx_process(OCG_Duel duel) { return OCG_DuelProcess(duel); }
KX_EXPORT(kx_get_message) void* kx_get_message(OCG_Duel duel, uint32_t* len) { return OCG_DuelGetMessage(duel, len); }
KX_EXPORT(kx_set_response) void kx_set_response(OCG_Duel duel, const void* buf, uint32_t len) { OCG_DuelSetResponse(duel, buf, len); }
KX_EXPORT(kx_load_script) int kx_load_script(OCG_Duel duel, const char* buf, uint32_t len, const char* name) {
	return OCG_LoadScript(duel, buf, len, name);
}
KX_EXPORT(kx_query_count) uint32_t kx_query_count(OCG_Duel duel, uint32_t team, uint32_t loc) {
	return OCG_DuelQueryCount(duel, static_cast<uint8_t>(team), loc);
}
static OCG_QueryInfo make_query(uint32_t flags, uint32_t con, uint32_t loc, uint32_t seq, uint32_t overlay) {
	OCG_QueryInfo q{};
	q.flags = flags;
	q.con = static_cast<uint8_t>(con);
	q.loc = loc;
	q.seq = seq;
	q.overlay_seq = overlay;
	return q;
}
KX_EXPORT(kx_query) void* kx_query(OCG_Duel duel, uint32_t* len, uint32_t flags, uint32_t con, uint32_t loc, uint32_t seq, uint32_t overlay) {
	auto q = make_query(flags, con, loc, seq, overlay);
	return OCG_DuelQuery(duel, len, &q);
}
KX_EXPORT(kx_query_location) void* kx_query_location(OCG_Duel duel, uint32_t* len, uint32_t flags, uint32_t con, uint32_t loc) {
	auto q = make_query(flags, con, loc, 0, 0);
	return OCG_DuelQueryLocation(duel, len, &q);
}
KX_EXPORT(kx_query_field) void* kx_query_field(OCG_Duel duel, uint32_t* len) { return OCG_DuelQueryField(duel, len); }

// Lua's io library references tmpfile(), which WASI lacks. Unsafe libraries are
// disabled for duels, so this is never reached; it only satisfies the linker.
#include <cstdio>
extern "C" FILE* tmpfile(void) { return nullptr; }
