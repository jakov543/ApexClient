package com.apexclient.discord;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Runs Discord Rich Presence on a background thread.
 * The game thread calls {@link #update}; the worker pushes changes to Discord
 * (max once every 5 s to respect Discord's rate limit) and reconnects if Discord restarts.
 */
public final class RichPresence {

    public record Data(String details, String state, String largeText,
                       String smallImage, String smallText,
                       String buttonLabel, String buttonUrl) {}

    private final String clientId;
    private final String largeImage;
    private final long startSeconds = System.currentTimeMillis() / 1000L;
    private final Consumer<String> log;

    private volatile Data latest;
    private Data sent;
    private long nextConnectAttempt;
    private DiscordIPC ipc;
    private ScheduledExecutorService worker;

    public RichPresence(String clientId, String largeImage, Consumer<String> log) {
        this.clientId = clientId;
        this.largeImage = largeImage;
        this.log = log;
    }

    public void start() {
        worker = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "ApexClient-DiscordRPC");
            t.setDaemon(true);
            return t;
        });
        worker.scheduleWithFixedDelay(this::tick, 1, 5, TimeUnit.SECONDS);
    }

    public void update(Data data) {
        this.latest = data;
    }

    public void stop() {
        if (worker == null) return;
        worker.shutdownNow();
        if (ipc != null) {
            try { ipc.setActivity(null); } catch (Exception ignored) {}
            ipc.close();
        }
    }

    private void tick() {
        try {
            if (ipc == null || !ipc.isConnected()) {
                if (System.currentTimeMillis() < nextConnectAttempt) return;
                nextConnectAttempt = System.currentTimeMillis() + 15_000;
                ipc = new DiscordIPC(clientId);
                ipc.connect();
                sent = null;
                log.accept("Connected to Discord");
            }
            Data d = latest;
            if (d != null && !d.equals(sent)) {
                ipc.setActivity(toJson(d));
                sent = d;
            }
        } catch (Exception e) {
            if (ipc != null) ipc.close();
            ipc = null;
            log.accept("Discord RPC: " + e.getMessage() + " (retrying in 15s)");
        }
    }

    private String toJson(Data d) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"details\":").append(Json.str(clip(d.details())));
        sb.append(",\"state\":").append(Json.str(clip(d.state())));
        sb.append(",\"timestamps\":{\"start\":").append(startSeconds).append('}');
        sb.append(",\"assets\":{\"large_image\":").append(Json.str(largeImage));
        sb.append(",\"large_text\":").append(Json.str(clip(d.largeText())));
        if (d.smallImage() != null && !d.smallImage().isBlank()) {
            sb.append(",\"small_image\":").append(Json.str(d.smallImage()));
            sb.append(",\"small_text\":").append(Json.str(clip(d.smallText())));
        }
        sb.append('}');
        if (d.buttonLabel() != null && !d.buttonLabel().isBlank()
                && d.buttonUrl() != null && d.buttonUrl().startsWith("http")) {
            sb.append(",\"buttons\":[{\"label\":").append(Json.str(clip(d.buttonLabel(), 32)))
              .append(",\"url\":").append(Json.str(d.buttonUrl())).append("}]");
        }
        return sb.append('}').toString();
    }

    private static String clip(String s) { return clip(s, 128); }

    private static String clip(String s, int max) {
        if (s == null || s.length() < 2) s = (s == null ? "" : s) + "  "; // Discord needs >= 2 chars
        return s.length() > max ? s.substring(0, max) : s;
    }
}
