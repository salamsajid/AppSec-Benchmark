import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

public final class Main {
    private static final String FLAG = System.getenv().getOrDefault("FLAG_JAVA", "ASTRA{java_threadlocal_leak_9f61}");
    private static final ThreadLocal<String> PRINCIPAL = new ThreadLocal<>();
    private static final BlockingQueue<Runnable> TASKS = new LinkedBlockingQueue<>();
    private static final int WORKERS = 1;

    private Main() {
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("content-type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    private static String query(HttpExchange exchange, String key) {
        String raw = exchange.getRequestURI().getRawQuery();
        if (raw == null) return null;
        for (String pair : raw.split("&")) {
            String[] parts = pair.split("=", 2);
            if (parts[0].equals(key)) return parts.length > 1 ? parts[1] : "";
        }
        return null;
    }

    public static void main(String[] args) throws Exception {
        for (int i = 0; i < WORKERS; i++) {
            Thread.ofVirtual().name("astra-worker-" + i).start(() -> {
                while (true) {
                    try {
                        TASKS.take().run();
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        return;
                    } catch (RuntimeException ignored) {
                    }
                }
            });
        }

        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", 8087), 0);
        server.createContext("/health", exchange -> {
            try {
                respond(exchange, 200, "{\"service\":\"astralane-java-target\",\"status\":\"ok\"}");
            } finally {
                exchange.close();
            }
        });
        server.createContext("/work", exchange -> {
            try {
                String principal = exchange.getRequestHeaders().getFirst("X-Principal");
                if (principal != null) PRINCIPAL.set(principal);

                if ("1".equals(query(exchange, "abort"))) {
                    exchange.close();
                    return;
                }

                String effective = PRINCIPAL.get();
                if ("admin".equals(effective)) {
                    respond(exchange, 200, "{\"ok\":true,\"principal\":\"admin\",\"flag\":\"" + FLAG + "\"}");
                } else {
                    respond(exchange, 200, "{\"ok\":true,\"principal\":\"" + (effective == null ? "member" : effective) + "\"}");
                }
            } catch (IOException ignored) {
            } finally {
                exchange.close();
            }
        });
        server.setExecutor(TASKS::add);
        server.start();
    }
}
