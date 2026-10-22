#!/usr/bin/env bash
# Builds libc++ / libc++abi / libunwind for wasm32-wasip1 WITH C++ exceptions
# (-fwasm-exceptions). The stock wasi-sdk runtimes are built without them, but
# ygopro-core needs exceptions to unwind Lua errors safely.
#
#   WASI_SDK=/path/to/wasi-sdk-30.0-x86_64-linux  LLVM_SRC=/path/to/llvm-project  OUT=/path/to/eh  ./build-runtimes.sh
#
# LLVM_SRC: sparse checkout of llvm-project at the tag matching wasi-sdk's clang
# (wasi-sdk 30 -> llvmorg-21.1.4) with: runtimes libcxx libcxxabi libunwind cmake llvm/cmake libc third-party
# Produces $OUT/sysroot (wasi-sysroot copy) and $OUT/lib/{libc++,libc++abi,libunwind}.a + headers.
set -euo pipefail
: "${WASI_SDK:?}" "${LLVM_SRC:?}" "${OUT:?}"
SYS="$OUT/sysroot"
rm -rf "$OUT" && mkdir -p "$OUT/lib"
cp -r "$WASI_SDK/share/wasi-sysroot" "$SYS"
FL="--target=wasm32-wasip1 --sysroot=$SYS -fwasm-exceptions -O2"
B="$(mktemp -d)"
cmake -S "$LLVM_SRC/runtimes" -B "$B" -G "Unix Makefiles" \
  -DCMAKE_TOOLCHAIN_FILE="$WASI_SDK/share/cmake/wasi-sdk.cmake" -DWASI_SDK_PREFIX="$WASI_SDK" \
  -DCMAKE_C_COMPILER="$WASI_SDK/bin/clang" -DCMAKE_CXX_COMPILER="$WASI_SDK/bin/clang++" \
  -DCMAKE_AR="$WASI_SDK/bin/llvm-ar" -DCMAKE_RANLIB="$WASI_SDK/bin/llvm-ranlib" \
  -DCMAKE_C_COMPILER_WORKS=ON -DCMAKE_CXX_COMPILER_WORKS=ON -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_SYSROOT="$SYS" -DCMAKE_INSTALL_PREFIX="$OUT" \
  -DLLVM_ENABLE_RUNTIMES="libcxxabi;libcxx" -DLLVM_COMPILER_CHECKED=ON \
  -DCMAKE_C_FLAGS="$FL" -DCMAKE_CXX_FLAGS="$FL" \
  -DLIBCXX_ENABLE_THREADS=OFF -DLIBCXX_ENABLE_SHARED=OFF -DLIBCXX_ENABLE_EXCEPTIONS=ON -DLIBCXX_ENABLE_FILESYSTEM=OFF \
  -DLIBCXX_CXX_ABI=libcxxabi -DLIBCXX_HAS_MUSL_LIBC=ON -DLIBCXX_ABI_VERSION=2 -DLIBCXX_ENABLE_ABI_LINKER_SCRIPT=OFF \
  -DLIBCXX_INCLUDE_TESTS=OFF -DLIBCXX_INCLUDE_BENCHMARKS=OFF -DLIBCXX_HERMETIC_STATIC_LIBRARY=ON \
  -DLIBCXXABI_ENABLE_EXCEPTIONS=ON -DLIBCXXABI_ENABLE_SHARED=OFF -DLIBCXXABI_ENABLE_THREADS=OFF \
  -DLIBCXXABI_USE_LLVM_UNWINDER=OFF -DLIBCXXABI_SILENT_TERMINATE=ON -DLIBCXXABI_HERMETIC_STATIC_LIBRARY=ON -DUNIX=ON
make -C "$B" -j"$(nproc)" && make -C "$B" install
# libunwind's wasm unwinder is a single C file (its assembly parts do not apply to wasm).
"$WASI_SDK/bin/clang" $FL -DNDEBUG -D_LIBUNWIND_HIDE_SYMBOLS -I"$LLVM_SRC/libunwind/include" -w \
  -c "$LLVM_SRC/libunwind/src/Unwind-wasm.c" -o "$B/unwind-wasm.o"
"$WASI_SDK/bin/llvm-ar" rcs "$OUT/lib/libunwind.a" "$B/unwind-wasm.o"
rm -rf "$B"
echo "EH runtimes in $OUT (use SYSROOT=$SYS EH_PREFIX=$OUT with build.sh)"
