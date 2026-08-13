# =========================
# Stage 1: Build
# =========================
FROM ubuntu:24.04 AS builder

# Install compiler, CMake and build tools
RUN apt-get update && \
    apt-get install -y \
    g++ \
    cmake \
    make \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy the C++ project
COPY CMakeLists.txt .
COPY include/ ./include/
COPY src/ ./src/

# Build the matching engine
RUN cmake -S . -B build && \
    cmake --build build --config Release


# =========================
# Stage 2: Runtime
# =========================
FROM ubuntu:24.04

# Install runtime library required by the application
RUN apt-get update && \
    apt-get install -y \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only the compiled executable
COPY --from=builder /app/build/matching_engine ./matching_engine

# Matching engine TCP port
EXPOSE 9000

# Start the matching engine
CMD ["./matching_engine", "9000"]