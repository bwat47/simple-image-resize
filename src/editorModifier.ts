import { ImageContext, ResizeDialogResult } from './types';

export function buildNewSyntax(context: ImageContext, result: ResizeDialogResult): string {
  // If the target is Markdown, we can't apply dimensions, so just return the basic syntax.
  if (result.targetSyntax === 'markdown') {
    return `![${result.altText}](:/${context.resourceId})`;
  }

  // If the target is HTML, calculate the new dimensions.
  let newWidth: number;
  let newHeight: number;

  if (result.resizeMode === 'percentage') {
    const percent = result.percentage || 100;
    newWidth = Math.round(context.originalDimensions.width * (percent / 100));
    newHeight = Math.round(context.originalDimensions.height * (percent / 100));
  } else { // absolute
    newWidth = result.absoluteWidth || context.originalDimensions.width;
    newHeight = result.absoluteHeight || context.originalDimensions.height;
  }

  // Build the final HTML <img> tag.
  return `<img src=":/${context.resourceId}" alt="${result.altText}" width="${newWidth}" height="${newHeight}" />`;
}
