package com.naavi.tools;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Shared executor for the (blocking, I/O-bound) travel tools so they can run in parallel. */
public final class ToolExecutor {
    public static final ExecutorService EXEC = Executors.newVirtualThreadPerTaskExecutor();

    private ToolExecutor() {}
}
