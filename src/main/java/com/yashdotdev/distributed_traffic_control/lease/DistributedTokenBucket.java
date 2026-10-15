package com.yashdotdev.distributed_traffic_control.lease;

import java.time.Instant;

public interface DistributedTokenBucket {

    long tryConsume(
            GlobalCapacityKey capacityKey,
            long capacity,
            long refillRate,
            Instant currentTime);
}
