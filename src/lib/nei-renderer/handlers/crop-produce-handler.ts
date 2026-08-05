import type { NeiDrawCommand } from "../core/commands";
import type { NeiPositionedStack } from "../core/positioned-stack";
import type { NeiRecipeHandler } from "../core/recipe-handler";
import type { NeiSize } from "../core/render-model";
import {
  basePanel,
  frameToPositionedStack,
  frameToSlotCommand,
  gregtechLayout,
  progressCommandsFromLayout,
} from "./command-helpers";

/**
 * Crop recipes use the same exported slot contract as every other recipe.
 * The former decorative soil scene had its own coordinates and routinely
 * disagreed with both the dataset and the legacy NEI preview.
 */
export const CropProduceHandler: NeiRecipeHandler = {
  id: "crop-produce",
  label: "Crop Produce",

  canHandle(recipe) {
    return recipe.kind === "crop_produce";
  },

  getDimensions(recipe): NeiSize {
    return gregtechLayout(recipe).canvas;
  },

  drawBackground(recipe): NeiDrawCommand[] {
    const layout = gregtechLayout(recipe);
    return [
      basePanel(layout.canvas.width, layout.canvas.height),
      ...layout.decorations.map(
        (decoration, index): NeiDrawCommand =>
          decoration.kind === "texture"
            ? {
                type: "texture",
                layer: "decoration",
                x: decoration.x,
                y: decoration.y,
                width: decoration.width,
                height: decoration.height,
                imagePath: decoration.imagePath,
                textureWidth: decoration.textureWidth,
                textureHeight: decoration.textureHeight,
                sourceX: decoration.sourceX,
                sourceY: decoration.sourceY,
                sourceWidth: decoration.sourceWidth,
                sourceHeight: decoration.sourceHeight,
                opacity: decoration.opacity,
                id: `decoration-${index}`,
              }
            : {
                type: "rect",
                layer: "decoration",
                x: decoration.x,
                y: decoration.y,
                width: decoration.width,
                height: decoration.height,
                color: decoration.color,
                id: `decoration-${index}`,
              },
      ),
      ...progressCommandsFromLayout(recipe),
      ...layout.frames.map((frame) =>
        frameToSlotCommand(frame, layout.unframedSlotKinds.includes(frame.kind)),
      ),
    ];
  },

  getInputs(recipe): NeiPositionedStack[] {
    return positionedStacksForSide(recipe, "input");
  },

  getOutputs(recipe): NeiPositionedStack[] {
    return positionedStacksForSide(recipe, "output");
  },

  drawForeground(): NeiDrawCommand[] {
    return [];
  },
};

function positionedStacksForSide(
  recipe: Parameters<typeof gregtechLayout>[0],
  side: "input" | "output",
) {
  return gregtechLayout(recipe).frames.flatMap((frame) => {
    if (frame.side !== side) return [];
    const stack = frameToPositionedStack(frame);
    return stack ? [stack] : [];
  });
}
