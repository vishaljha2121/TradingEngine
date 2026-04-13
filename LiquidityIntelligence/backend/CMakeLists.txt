cmake_minimum_required(VERSION 3.14)
project(LiquidityIntelligence C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(ZLIB REQUIRED)
find_package(Threads REQUIRED)
find_package(CURL REQUIRED)

set(UWS_DIR ${CMAKE_CURRENT_SOURCE_DIR}/lib/uWebSockets)
set(USOCKETS_DIR ${UWS_DIR}/uSockets)

# Import the precompiled uSockets.a generated natively by their Makefile
add_library(uSockets STATIC IMPORTED)
set_target_properties(uSockets PROPERTIES IMPORTED_LOCATION ${USOCKETS_DIR}/uSockets.a)

set(SOURCES
    src/main.cpp
)

add_executable(liquidity_console ${SOURCES})

target_include_directories(liquidity_console PRIVATE 
    ${UWS_DIR}/src 
    ${USOCKETS_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_definitions(liquidity_console PRIVATE LIBUS_NO_SSL)

# Mac requires CoreFoundation for event loop
if (APPLE)
    find_library(CORE_FOUNDATION CoreFoundation)
    target_link_libraries(liquidity_console PRIVATE uSockets ZLIB::ZLIB Threads::Threads CURL::libcurl ${CORE_FOUNDATION})
else()
    target_link_libraries(liquidity_console PRIVATE uSockets ZLIB::ZLIB Threads::Threads CURL::libcurl)
endif()
