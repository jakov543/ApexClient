package com.apexclient.module;

import com.apexclient.ApexClient;
import com.apexclient.gui.HudEditorScreen;
import com.apexclient.module.impl.*;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderTickCounter;

import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** Holds every module, draws the HUD, and saves state to config/apexclient-modules.json. */
public final class ModuleManager {

    private static final List<Module> MODULES = new ArrayList<>();
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private ModuleManager() {}

    public static void init() {
        // HUD
        MODULES.add(new FpsModule());
        MODULES.add(new CpsModule());
        MODULES.add(new KeystrokesModule());
        MODULES.add(new CoordinatesModule());
        MODULES.add(new PingModule());
        MODULES.add(new ArmorStatusModule());
        MODULES.add(new PotionEffectsModule());
        MODULES.add(new ClockModule());
        MODULES.add(new ServerAddressModule());
        // PvP / utility
        MODULES.add(new ZoomModule());
        MODULES.add(new ToggleSprintModule());
        // Visual
        MODULES.add(new FullbrightModule());
        // Cosmetic
        MODULES.add(new CapeModule());
        load();
    }

    public static List<Module> all() { return MODULES; }

    public static List<HudModule> hud() {
        List<HudModule> list = new ArrayList<>();
        for (Module m : MODULES) if (m instanceof HudModule h) list.add(h);
        return list;
    }

    @SuppressWarnings("unchecked")
    public static <T extends Module> T get(Class<T> type) {
        for (Module m : MODULES) if (type.isInstance(m)) return (T) m;
        throw new IllegalArgumentException(type.getName());
    }

    public static void tick(MinecraftClient mc) {
        for (Module m : MODULES) if (m.isEnabled()) m.onTick(mc);
    }

    public static void renderHud(DrawContext ctx, RenderTickCounter tick) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null || mc.options.hudHidden || mc.getDebugHud().shouldShowDebugHud()) return;
        if (mc.currentScreen instanceof HudEditorScreen) return; // editor draws them itself
        int sw = ctx.getScaledWindowWidth(), sh = ctx.getScaledWindowHeight();
        for (HudModule h : hud()) {
            if (!h.isEnabled()) continue;
            h.clamp(sw, sh, mc);
            h.draw(ctx, mc, h.x, h.y, false);
        }
    }

    // ------------------------------------------------------------------ save / load

    private static Path file() {
        return FabricLoader.getInstance().getConfigDir().resolve("apexclient-modules.json");
    }

    public static void save() {
        JsonObject root = new JsonObject();
        for (Module m : MODULES) {
            JsonObject o = new JsonObject();
            o.addProperty("enabled", m.isEnabled());
            if (m instanceof HudModule h) {
                o.addProperty("x", h.x);
                o.addProperty("y", h.y);
            }
            root.add(m.getName(), o);
        }
        try (Writer w = Files.newBufferedWriter(file())) {
            GSON.toJson(root, w);
        } catch (Exception e) {
            ApexClient.LOG.warn("Could not save modules", e);
        }
    }

    private static void load() {
        Path f = file();
        if (!Files.exists(f)) { save(); return; }
        try (Reader r = Files.newBufferedReader(f)) {
            JsonObject root = GSON.fromJson(r, JsonObject.class);
            for (Module m : MODULES) {
                if (root == null || !root.has(m.getName())) continue;
                JsonObject o = root.getAsJsonObject(m.getName());
                if (o.has("enabled")) m.loadEnabled(o.get("enabled").getAsBoolean());
                if (m instanceof HudModule h) {
                    if (o.has("x")) h.x = o.get("x").getAsInt();
                    if (o.has("y")) h.y = o.get("y").getAsInt();
                }
            }
        } catch (Exception e) {
            ApexClient.LOG.warn("Could not load modules", e);
        }
    }
}
