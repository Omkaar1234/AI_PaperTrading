cmake_minimum_required(VERSION 3.14)
project(MatchingEngine)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
    src/main.cpp
    src/order_book.cpp
    src/trade_executor.cpp
    src/network_server.cpp
)

# Header files
include_directories(include)

# Create executable
add_executable(matching_engine ${SOURCES})

# Platform-specific socket libraries
if(WIN32)
    target_link_libraries(matching_engine ws2_32)
else()
    target_link_libraries(matching_engine pthread)
endif()

# Enable warnings
if(MSVC)
    target_compile_options(matching_engine PRIVATE /W4)
else()
    target_compile_options(matching_engine PRIVATE -Wall -Wextra -Wpedantic)
endif()
