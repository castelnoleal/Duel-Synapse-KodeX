#!/usr/bin/env bash
# Builds duel/engine/ocgcore.wasm from edo9300/ygopro-core with wasi-sdk.
#
# Requirements (all fetched from GitHub):
#   WASI_SDK   path to wasi-sdk >= 30 (https://github.com/WebAssembly/wasi-sdk/releases)
#   EH_PREFIX  libc++/libc++abi/libunwind built with -fwasm-exceptions (see build-runtimes.sh)
#   CORE_DIR   checkout of https://github.com/edo9300/ygopro-core with lua/src submodule
#
# The core relies on C++ exceptions to unwind Lua errors safely, which the stock
# wasi-sdk libc++ does not provide, hence the custom EH runtimes.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-$HERE/../ocgcore.wasm}"
: "${WASI_SDK:?set WASI_SDK}" "${EH_PREFIX:?set EH_PREFIX}" "${CORE_DIR:?set CORE_DIR}"
SYSROOT="${SYSROOT:-$WASI_SDK/share/wasi-sysroot}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

CXX="$WASI_SDK/bin/clang++"
COMMON=(--target=wasm32-wasip1 --sysroot="$SYSROOT" -O2 -fwasm-exceptions -fno-rtti
  -nostdinc++ -isystem "$EH_PREFIX/include/c++/v1" -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS
  -DLUA_EPRO_APICHECK -Wno-everything)

objs=()
# Lua is compiled as C++ with the core's customisation header prepended.
for f in lapi lauxlib lbaselib lcode lctype ldebug ldo ldump lfunc lgc liolib llex lmathlib lmem \
         lobject lopcodes lparser lstate lstring lstrlib ltable ltablib ltm lundump lvm lzio; do
  cat "$CORE_DIR/lua/luaconf-customize.h" "$CORE_DIR/lua/src/$f.c" > "$TMP/$f.cpp"
  "$CXX" "${COMMON[@]}" -std=c++17 -I"$CORE_DIR/lua/src" -c "$TMP/$f.cpp" -o "$TMP/$f.o" &
  objs+=("$TMP/$f.o")
done
for f in card duel effect field interpreter libcard libdebug libduel libeffect libgroup ocgapi \
         operations playerop processor processor_visit scriptlib; do
  "$CXX" "${COMMON[@]}" -std=c++17 -I"$CORE_DIR/lua/src" -I"$CORE_DIR" -c "$CORE_DIR/$f.cpp" -o "$TMP/core_$f.o" &
  objs+=("$TMP/core_$f.o")
done
"$CXX" "${COMMON[@]}" -std=c++17 -I"$CORE_DIR/lua/src" -I"$CORE_DIR" -c "$HERE/kx_shim.cpp" -o "$TMP/kx_shim.o" &
objs+=("$TMP/kx_shim.o")
wait

"$CXX" --target=wasm32-wasip1 --sysroot="$SYSROOT" -O2 -fwasm-exceptions -mexec-model=reactor \
  -nostdlib++ -L"$EH_PREFIX/lib" "${objs[@]}" -lc++ -lc++abi -lunwind \
  -lwasi-emulated-signal -lwasi-emulated-process-clocks \
  -Wl,--strip-all -Wl,-z,stack-size=2097152 -Wl,--initial-memory=33554432 \
  -o "$OUT"
echo "built $OUT ($(stat -c %s "$OUT") bytes)"
