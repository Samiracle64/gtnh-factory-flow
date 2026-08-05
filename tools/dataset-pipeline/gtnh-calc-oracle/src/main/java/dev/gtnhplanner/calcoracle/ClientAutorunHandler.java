package dev.gtnhplanner.calcoracle;

import cpw.mods.fml.common.eventhandler.SubscribeEvent;
import cpw.mods.fml.common.gameevent.TickEvent;
import net.minecraft.client.Minecraft;

public final class ClientAutorunHandler {

    private int ticks;
    private boolean started;

    @SubscribeEvent
    public void onClientTick(TickEvent.ClientTickEvent event) {
        if (event.phase != TickEvent.Phase.END) {
            return;
        }

        ClientRenderTaskQueue.drain();
        if (started) {
            return;
        }

        ticks++;
        if (ticks < Integer.getInteger("gtnh.oracle.autorunDelayTicks", 220)) {
            return;
        }

        Minecraft minecraft = Minecraft.getMinecraft();
        if (minecraft == null || minecraft.getTextureManager() == null || minecraft.fontRenderer == null) {
            return;
        }

        started = true;
        GtnhCalcOracleMod.LOG.info("GTNH calculation oracle client is ready after {} ticks.", Integer.valueOf(ticks));
        GtnhCalcOracleMod.requestAutorunExport("client-tick");
    }
}
