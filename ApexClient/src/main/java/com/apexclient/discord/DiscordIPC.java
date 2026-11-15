package com.apexclient.discord;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.net.StandardProtocolFamily;
import java.net.UnixDomainSocketAddress;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

/**
 * Minimal Discord IPC client (no external libraries).
 * Talks to the local Discord app over a named pipe (Windows) or unix socket (Linux/macOS).
 * All reads and writes happen on ONE thread (Windows pipes deadlock on concurrent read/write).
 */
public final class DiscordIPC {

    private static final int OP_HANDSHAKE = 0;
    private static final int OP_FRAME = 1;
    private static final int OP_CLOSE = 2;

    private interface Pipe {
        void write(byte[] data) throws IOException;
        void readFully(byte[] dst) throws IOException;
        void close();
    }

    private final String clientId;
    private Pipe pipe;

    public DiscordIPC(String clientId) {
        this.clientId = clientId;
    }

    public boolean isConnected() {
        return pipe != null;
    }

    /** Connects and performs the handshake. Throws if Discord is not running or the client id is wrong. */
    public void connect() throws IOException {
        IOException last = null;
        for (int i = 0; i < 10; i++) {
            try {
                pipe = open(i);
                break;
            } catch (IOException e) {
                last = e;
            }
        }
        if (pipe == null) throw new IOException("Discord is not running (no IPC pipe found)", last);

        send(OP_HANDSHAKE, "{\"v\":1,\"client_id\":\"" + Json.esc(clientId) + "\"}");
        Frame ready = read();
        if (ready.op == OP_CLOSE || !ready.json.contains("\"READY\"")) {
            close();
            throw new IOException("Discord handshake failed: " + ready.json);
        }
    }

    /** Sends a SET_ACTIVITY command. Pass null to clear the presence. */
    public void setActivity(String activityJson) throws IOException {
        if (pipe == null) throw new IOException("Not connected");
        String payload = "{\"cmd\":\"SET_ACTIVITY\",\"args\":{\"pid\":" + ProcessHandle.current().pid()
                + ",\"activity\":" + (activityJson == null ? "null" : activityJson) + "},\"nonce\":\""
                + UUID.randomUUID() + "\"}";
        send(OP_FRAME, payload);
        Frame resp = read(); // Discord answers every command; read it so the pipe never fills up
        if (resp.op == OP_CLOSE) {
            close();
            throw new IOException("Discord closed the connection: " + resp.json);
        }
    }

    public void close() {
        if (pipe != null) {
            try { send(OP_CLOSE, "{}"); } catch (Exception ignored) {}
            pipe.close();
            pipe = null;
        }
    }

    // ------------------------------------------------------------------ internals

    private record Frame(int op, String json) {}

    private void send(int op, String json) throws IOException {
        byte[] body = json.getBytes(StandardCharsets.UTF_8);
        ByteBuffer buf = ByteBuffer.allocate(8 + body.length).order(ByteOrder.LITTLE_ENDIAN);
        buf.putInt(op).putInt(body.length).put(body);
        pipe.write(buf.array());
    }

    private Frame read() throws IOException {
        byte[] header = new byte[8];
        pipe.readFully(header);
        ByteBuffer hb = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN);
        int op = hb.getInt();
        int len = hb.getInt();
        if (len < 0 || len > 1 << 20) throw new IOException("Bad frame length " + len);
        byte[] body = new byte[len];
        pipe.readFully(body);
        return new Frame(op, new String(body, StandardCharsets.UTF_8));
    }

    private static Pipe open(int index) throws IOException {
        String name = "discord-ipc-" + index;
        if (System.getProperty("os.name", "").toLowerCase().contains("win")) {
            RandomAccessFile raf = new RandomAccessFile("\\\\?\\pipe\\" + name, "rw");
            return new Pipe() {
                public void write(byte[] d) throws IOException { raf.write(d); }
                public void readFully(byte[] d) throws IOException { raf.readFully(d); }
                public void close() { try { raf.close(); } catch (IOException ignored) {} }
            };
        }

        // Linux / macOS: look in the usual temp directories (incl. Flatpak/Snap Discord)
        String[] envs = {"XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"};
        String[] subdirs = {"", "app/com.discordapp.Discord", "snap.discord", ".flatpak/com.discordapp.Discord/xdg-run"};
        for (String env : envs) {
            String base = System.getenv(env);
            if (base == null) continue;
            for (String sub : subdirs) {
                Path p = Path.of(base, sub, name);
                if (Files.exists(p)) return unix(p);
            }
        }
        Path p = Path.of("/tmp", name);
        if (Files.exists(p)) return unix(p);
        throw new IOException("No socket " + name);
    }

    private static Pipe unix(Path path) throws IOException {
        SocketChannel ch = SocketChannel.open(StandardProtocolFamily.UNIX);
        ch.connect(UnixDomainSocketAddress.of(path));
        return new Pipe() {
            public void write(byte[] d) throws IOException {
                ByteBuffer b = ByteBuffer.wrap(d);
                while (b.hasRemaining()) ch.write(b);
            }
            public void readFully(byte[] d) throws IOException {
                ByteBuffer b = ByteBuffer.wrap(d);
                while (b.hasRemaining()) if (ch.read(b) < 0) throw new IOException("Socket closed");
            }
            public void close() { try { ch.close(); } catch (IOException ignored) {} }
        };
    }
}
