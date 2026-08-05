package dev.gtnhplanner.calcoracle;

import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public final class ClientRenderTaskQueue {

    private static final ConcurrentLinkedQueue<FutureTask<?>> TASKS = new ConcurrentLinkedQueue<FutureTask<?>>();
    private static volatile Thread clientThread;

    private ClientRenderTaskQueue() {}

    public static <T> T call(Callable<T> callable) throws Exception {
        if (Thread.currentThread() == clientThread) {
            return callable.call();
        }

        FutureTask<T> task = new FutureTask<T>(callable);
        TASKS.add(task);
        try {
            return task.get(Long.getLong("gtnh.oracle.clientRenderTimeoutSeconds", 60L), TimeUnit.SECONDS);
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof Exception) {
                throw (Exception) cause;
            }
            if (cause instanceof Error) {
                throw (Error) cause;
            }
            throw new RuntimeException(cause);
        } catch (TimeoutException e) {
            TASKS.remove(task);
            throw new IllegalStateException("Timed out waiting for the Minecraft client render thread.", e);
        }
    }

    public static void drain() {
        clientThread = Thread.currentThread();
        FutureTask<?> task;
        while ((task = TASKS.poll()) != null) {
            task.run();
        }
    }
}
