package com.naavi.tools;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

/** Tiny local HTTP server so tool tests never touch the real internet. */
final class MockServer implements AutoCloseable {
    final HttpServer server;
    final AtomicInteger hits = new AtomicInteger();

    MockServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
    }

    MockServer respond(String path, int status, String body) {
        server.createContext(path, ex -> {
            hits.incrementAndGet();
            byte[] b = body.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(status, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
        return this;
    }

    String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
