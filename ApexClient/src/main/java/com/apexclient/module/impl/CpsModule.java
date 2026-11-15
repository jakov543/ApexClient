package com.apexclient.module.impl;

import com.apexclient.module.TextHudModule;
import net.minecraft.client.MinecraftClient;

import java.util.ArrayDeque;
import java.util.Deque;

/** Clicks per second. Clicks are recorded by MouseMixin. */
public class CpsModule extends TextHudModule {

    private static final Deque<Long> LEFT = new ArrayDeque<>();
    private static final Deque<Long> RIGHT = new ArrayDeque<>();

    public CpsModule() { super("CPS", "Clicks per second (left | right)", true, 4, 22); }

    public static void click(int button) {
        long now = System.currentTimeMillis();
        if (button == 0) LEFT.addLast(now);
        else if (button == 1) RIGHT.addLast(now);
    }

    public static int left() { return count(LEFT); }
    public static int right() { return count(RIGHT); }

    private static int count(Deque<Long> q) {
        long cutoff = System.currentTimeMillis() - 1000;
        while (!q.isEmpty() && q.peekFirst() < cutoff) q.pollFirst();
        return q.size();
    }

    @Override
    protected String getText(MinecraftClient mc, boolean preview) {
        return left() + " | " + right() + " CPS";
    }
}
