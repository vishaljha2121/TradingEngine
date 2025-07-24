cmake_minimum_required(VERSION 3.10)
project(trading_engine)

set(CMAKE_CXX_STANDARD 17)

include_directories(include)

add_executable(trading_engine
        src/main.cpp
        src/order.cpp
        src/order_book.cpp
)
