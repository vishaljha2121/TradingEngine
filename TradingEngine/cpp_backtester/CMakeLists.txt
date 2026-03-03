cmake_minimum_required(VERSION 3.14)
project(TrueMarketsBacktester CXX)

# Require C++17
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Enable highest optimization flags for backend trading systems
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -march=native -flto -funroll-loops")
    # Wall extra warnings, but not treating them as errors for now
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra")
endif()

# Source files
set(SOURCES
    src/main.cpp
    src/OrderBook.cpp
)

# Output executable
add_executable(backtester ${SOURCES})

# Include directories
target_include_directories(backtester PRIVATE src)
