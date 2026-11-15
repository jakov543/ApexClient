package com.apexclient.module.impl;

import com.apexclient.module.Module;

/** Hold the Zoom key (C) to zoom. Handled in GameRendererMixin; scroll while zooming to change it. */
public class ZoomModule extends Module {
    public static double zoomFov = 15.0;

    public ZoomModule() { super("Zoom", "Hold C to zoom, scroll to adjust", Category.PVP, true); }
}
