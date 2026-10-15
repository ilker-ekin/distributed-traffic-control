package com.yashdotdev.distributed_traffic_control.traffic;

import com.yashdotdev.distributed_traffic_control.lease.DistributedTokenBucket;
import com.yashdotdev.distributed_traffic_control.lease.GlobalCapacityKey;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

final class InMemoryDistributedTokenBucket implements DistributedTokenBucket {

    private static final class Bucket {
        private double tokens;
        private Instant lastRefill;

        private Bucket(long capacity, Instant now) {
            this.tokens = capacity;
            this.lastRefill = now;
        }
    }

    private final Map<GlobalCapacityKey, Bucket> buckets = new HashMap<>();
    private final Clock clock;

    InMemoryDistributedTokenBucket() {
        this(Clock.systemUTC());
    }

    InMemoryDistributedTokenBucket(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock must not be null");
    }

    @Override
    public synchronized long tryConsume(
            GlobalCapacityKey capacityKey,
            long capacity,
            long refillRate,
            Instant currentTime) {

        Objects.requireNonNull(capacityKey, "capacityKey must not be null");
        Objects.requireNonNull(currentTime, "currentTime must not be null");

        if (capacity <= 0 || refillRate <= 0) {
            throw new IllegalArgumentException(
                    "Capacity and refill rate must be positive");
        }

        Instant now = clock.instant();

        Bucket bucket = buckets.computeIfAbsent(
                capacityKey,
                key -> new Bucket(capacity, now));

        long elapsedMillis = Math.max(
                0L,
                Duration.between(bucket.lastRefill, now).toMillis());

        double refilledTokens =
                elapsedMillis * (double) refillRate / 1000.0;

        bucket.tokens = Math.min(
                capacity,
                bucket.tokens + refilledTokens);

        if (now.isAfter(bucket.lastRefill)) {
            bucket.lastRefill = now;
        }

        if (bucket.tokens < 1.0) {
            return -1L;
        }

        bucket.tokens -= 1.0;

        return (long) Math.floor(bucket.tokens);
    }
}
