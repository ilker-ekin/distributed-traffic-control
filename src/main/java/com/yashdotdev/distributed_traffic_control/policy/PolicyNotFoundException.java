package com.yashdotdev.distributed_traffic_control.policy;

public class PolicyNotFoundException extends RuntimeException {

    public PolicyNotFoundException(String resource) {
        super("No policy registered for resource: " + resource);
    }
}
