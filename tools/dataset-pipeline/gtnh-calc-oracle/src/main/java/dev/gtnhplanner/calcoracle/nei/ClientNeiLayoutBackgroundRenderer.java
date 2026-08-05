package dev.gtnhplanner.calcoracle.nei;

import dev.gtnhplanner.calcoracle.ClientRenderTaskQueue;
import dev.gtnhplanner.calcoracle.GtnhCalcOracleMod;
import net.minecraft.client.shader.Framebuffer;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.GL11;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Callable;

public final class ClientNeiLayoutBackgroundRenderer {

    private static final Map<String, String> CAPTURES_BY_CATEGORY = new LinkedHashMap<String, String>();

    private ClientNeiLayoutBackgroundRenderer() {}

    public static String capture(
        final Object handler,
        final int recipeIndex,
        final String type,
        String signature,
        int width,
        int height
    ) {
        String outputDir = System.getProperty("gtnh.oracle.neiLayoutDir", "");
        if (outputDir.length() == 0) {
            return null;
        }

        final int captureWidth = Math.max(1, width);
        final int captureHeight = Math.max(1, height);
        String categoryKey = handler.getClass().getName()
            + ":" + String.valueOf(type)
            + ":" + captureWidth
            + "x" + captureHeight;
        String cached = CAPTURES_BY_CATEGORY.get(categoryKey);
        if (cached != null) {
            return cached.length() == 0 ? null : cached;
        }

        String fileName = "nei-" + safeName(type) + "-" + sha1(categoryKey).substring(0, 12) + ".png";
        File dir = new File(outputDir);
        if (!dir.isDirectory() && !dir.mkdirs()) {
            CAPTURES_BY_CATEGORY.put(categoryKey, "");
            return null;
        }
        final File output = new File(dir, fileName);
        final String captureSignature = signature;
        String datasetVersionId = System.getProperty("gtnh.oracle.datasetVersionId", "");
        final String datasetPath = datasetVersionId.length() == 0
            ? output.getAbsolutePath()
            : "/datasets/gtnh/" + datasetVersionId + "/textures/nei-layouts/" + fileName;

        if (output.isFile()) {
            CAPTURES_BY_CATEGORY.put(categoryKey, datasetPath);
            return datasetPath;
        }

        try {
            Boolean captured = ClientRenderTaskQueue.call(new Callable<Boolean>() {
                @Override
                public Boolean call() {
                    return Boolean.valueOf(
                        captureOnClientThread(
                            handler,
                            recipeIndex,
                            captureSignature,
                            captureWidth,
                            captureHeight,
                            output
                        )
                    );
                }
            });
            String result = captured.booleanValue() ? datasetPath : "";
            CAPTURES_BY_CATEGORY.put(categoryKey, result);
            return result.length() == 0 ? null : result;
        } catch (Throwable t) {
            CAPTURES_BY_CATEGORY.put(categoryKey, "");
            GtnhCalcOracleMod.LOG.warn("Could not schedule NEI handler background for {}.", signature, t);
            return null;
        }
    }

    private static boolean captureOnClientThread(
        Object handler,
        int recipeIndex,
        String signature,
        int width,
        int height,
        File output
    ) {

        Framebuffer framebuffer = new Framebuffer(width, height, true);
        boolean projectionPushed = false;
        boolean modelViewPushed = false;
        try {
            framebuffer.bindFramebuffer(true);
            GL11.glViewport(0, 0, width, height);
            GL11.glClearColor(0.0F, 0.0F, 0.0F, 0.0F);
            GL11.glClear(GL11.GL_COLOR_BUFFER_BIT | GL11.GL_DEPTH_BUFFER_BIT);

            GL11.glMatrixMode(GL11.GL_PROJECTION);
            GL11.glPushMatrix();
            projectionPushed = true;
            GL11.glLoadIdentity();
            GL11.glOrtho(0.0D, width, height, 0.0D, 1000.0D, 3000.0D);

            GL11.glMatrixMode(GL11.GL_MODELVIEW);
            GL11.glPushMatrix();
            modelViewPushed = true;
            GL11.glLoadIdentity();
            GL11.glTranslatef(0.0F, 0.0F, -2000.0F);
            GL11.glEnable(GL11.GL_BLEND);

            Method drawBackground = handler.getClass().getMethod("drawBackground", Integer.TYPE);
            drawBackground.setAccessible(true);
            drawBackground.invoke(handler, Integer.valueOf(recipeIndex));
            GL11.glFlush();

            ByteBuffer buffer = BufferUtils.createByteBuffer(width * height * 4);
            GL11.glReadPixels(0, 0, width, height, GL11.GL_RGBA, GL11.GL_UNSIGNED_BYTE, buffer);
            ImageIO.write(imageFromRgbaBuffer(buffer, width, height), "png", output);
        } catch (Throwable t) {
            GtnhCalcOracleMod.LOG.warn("Could not render NEI handler background for {}.", signature, t);
            return false;
        } finally {
            if (modelViewPushed) {
                GL11.glMatrixMode(GL11.GL_MODELVIEW);
                GL11.glPopMatrix();
            }
            if (projectionPushed) {
                GL11.glMatrixMode(GL11.GL_PROJECTION);
                GL11.glPopMatrix();
            }
            GL11.glMatrixMode(GL11.GL_MODELVIEW);
            framebuffer.unbindFramebuffer();
            framebuffer.deleteFramebuffer();
        }
        return true;
    }

    private static BufferedImage imageFromRgbaBuffer(ByteBuffer buffer, int width, int height) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int index = ((height - 1 - y) * width + x) * 4;
                int r = buffer.get(index) & 0xFF;
                int g = buffer.get(index + 1) & 0xFF;
                int b = buffer.get(index + 2) & 0xFF;
                int a = buffer.get(index + 3) & 0xFF;
                image.setRGB(x, y, (a << 24) | (r << 16) | (g << 8) | b);
            }
        }
        return image;
    }

    private static String safeName(String value) {
        return value == null ? "nei" : value.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private static String sha1(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-1");
            byte[] data = digest.digest(String.valueOf(value).getBytes("UTF-8"));
            StringBuilder builder = new StringBuilder();
            for (byte b : data) {
                builder.append(String.format("%02x", Byte.valueOf(b)));
            }
            return builder.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
