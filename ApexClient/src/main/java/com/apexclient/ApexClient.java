package com.apexclient;

import com.apexclient.discord.RichPresence;
import com.apexclient.gui.ModMenuScreen;
import com.apexclient.module.ModuleManager;
import com.apexclient.module.impl.FullbrightModule;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.world.World;
import org.lwjgl.glfw.GLFW;
import org.lwjgl.glfw.GLFWImage;
import org.lwjgl.stb.STBImage;
import org.lwjgl.system.MemoryStack;
import org.lwjgl.system.MemoryUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.IntBuffer;

public class ApexClient implements ClientModInitializer {

    public static final String MOD_ID = "apexclient";
    public static final String NAME = "Apex Client";
    public static final String VERSION = "1.3.0";
    public static final Logger LOG = LoggerFactory.getLogger(NAME);

    public static KeyBinding zoomKey;
    public static KeyBinding menuKey;

    private static RichPresence rpc;
    private int tickCounter;

    @Override
    public void onInitializeClient() {
        ApexConfig.load();

        zoomKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.apexclient.zoom", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_C, "category.apexclient"));
        menuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.apexclient.menu", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, "category.apexclient"));

        ModuleManager.init();
        HudRenderCallback.EVENT.register(ModuleManager::renderHud);

        ClientLifecycleEvents.CLIENT_STARTED.register(client -> {
            setWindowIcon(client);
            if (ModuleManager.get(FullbrightModule.class).isEnabled()) ModuleManager.get(FullbrightModule.class).apply();
        });
        ClientLifecycleEvents.CLIENT_STOPPING.register(c -> {
            ModuleManager.save();
            if (ModuleManager.get(FullbrightModule.class).isEnabled()) ModuleManager.get(FullbrightModule.class).restore();
            if (rpc != null) rpc.stop();
        });

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (menuKey.wasPressed()) {
                if (client.currentScreen == null) client.setScreen(new ModMenuScreen(null));
            }
            ModuleManager.tick(client);
            if (rpc != null && ++tickCounter % 40 == 0) rpc.update(buildPresence(client));
        });

        startDiscord();
        LOG.info("{} {} loaded", NAME, VERSION);
    }

    private static void startDiscord() {
        if (!ApexConfig.discordEnabled) return;
        if (ApexConfig.discordClientId.isBlank() || ApexConfig.discordClientId.matches("0+")) {
            LOG.warn("Discord Rich Presence is off: set discord.clientId in config/apexclient.properties");
            return;
        }
        rpc = new RichPresence(ApexConfig.discordClientId, ApexConfig.discordLargeImage, LOG::info);
        rpc.update(new RichPresence.Data("Starting the game", NAME + " " + VERSION,
                NAME, null, null, ApexConfig.buttonLabel, ApexConfig.buttonUrl));
        rpc.start();
    }

    /** Collects what the player is doing. Runs on the game thread. */
    private static RichPresence.Data buildPresence(MinecraftClient mc) {
        String details;
        String state;
        String small = null;
        String smallText = null;

        if (mc.world == null || mc.player == null) {
            details = "In the main menu";
            state = NAME + " " + VERSION;
        } else {
            if (mc.isInSingleplayer() && mc.getServer() != null) {
                details = "Playing Singleplayer";
                state = "World: " + mc.getServer().getSaveProperties().getLevelName();
            } else {
                ServerInfo info = mc.getCurrentServerEntry();
                details = "Playing Multiplayer";
                if (info == null) state = "On a server";
                else if (ApexConfig.showServerAddress) state = info.address;
                else state = info.name;
            }
            var dim = mc.world.getRegistryKey();
            String base = ApexConfig.discordImageBase;
            if (dim == World.NETHER) { small = base + "nether.png"; smallText = "In the Nether"; }
            else if (dim == World.END) { small = base + "end.png"; smallText = "In the End"; }
            else { small = base + "overworld.png"; smallText = "In the Overworld"; }
        }
        return new RichPresence.Data(details, state, NAME + " " + VERSION + " • MC 1.21.1",
                small, smallText, ApexConfig.buttonLabel, ApexConfig.buttonUrl);
    }

    /** Replaces the Minecraft window icon with the Apex logo (Windows/Linux; macOS ignores this). */
    private static void setWindowIcon(MinecraftClient client) {
        if (System.getProperty("os.name", "").toLowerCase().contains("mac")) return;
        try (InputStream in = ApexClient.class.getResourceAsStream("/assets/apexclient/icon.png")) {
            if (in == null) return;
            byte[] bytes = in.readAllBytes();
            ByteBuffer file = MemoryUtil.memAlloc(bytes.length);
            file.put(bytes).flip();
            try (MemoryStack stack = MemoryStack.stackPush()) {
                IntBuffer w = stack.mallocInt(1), h = stack.mallocInt(1), ch = stack.mallocInt(1);
                ByteBuffer pixels = STBImage.stbi_load_from_memory(file, w, h, ch, 4);
                if (pixels != null) {
                    GLFWImage.Buffer images = GLFWImage.malloc(1, stack);
                    images.position(0).width(w.get(0)).height(h.get(0)).pixels(pixels);
                    GLFW.glfwSetWindowIcon(client.getWindow().getHandle(), images);
                    STBImage.stbi_image_free(pixels);
                }
            } finally {
                MemoryUtil.memFree(file);
            }
        } catch (Exception e) {
            LOG.warn("Could not set window icon", e);
        }
    }
}
