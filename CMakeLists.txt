cmake_minimum_required(VERSION 3.14)
project(OrderBook)

set(CMAKE_CXX_STANDARD 17)

# Include paths
include_directories(include)

# Build library from source files
add_library(orderbook_lib
        src/order.cpp
        src/order_book.cpp
        src/trade.cpp
        src/trade_log.cpp
        include/trade_log.hpp
        include/trade.hpp
)

# Main executable (optional)
add_executable(main_exec
        src/main.cpp
        src/trade.cpp
        include/trade.hpp
        include/trade_log.hpp
        src/trade_log.cpp
        src/cli_utils.cpp
        include/cli_utils.hpp)
target_link_libraries(main_exec orderbook_lib)

# GoogleTest
add_subdirectory(googletest)
include_directories(googletest/googletest/include)

enable_testing()

# Test files
add_executable(test_order tests/test_order.cpp)
target_link_libraries(test_order orderbook_lib gtest gtest_main)
add_test(NAME OrderTest COMMAND test_order)

add_executable(test_order_book tests/test_order_book.cpp)
target_link_libraries(test_order_book orderbook_lib gtest gtest_main)
add_test(NAME OrderBookTest COMMAND test_order_book)

# Auto-run tests when you build
add_custom_target(run_tests ALL
        COMMAND ${CMAKE_CTEST_COMMAND} --verbose
        DEPENDS test_order test_order_book
        WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -g -O0 --coverage")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} --coverage")
endif()

