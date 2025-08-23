import { ImageContext, ResizeDialogResult } from './types';

function updateHtmlAltText(html: string, newAltText: string): string {
    const altRegex = /alt="([^"]*)"/i;
    const altMatch = html.match(altRegex);
    if (altMatch) {
        return html.replace(altMatch[0], `alt="${newAltText}"`);
    } else {
        return html.replace(/<img/i, `<img alt="${newAltText}"`);
    }
}

export function buildNewSyntax(context: ImageContext, result: ResizeDialogResult): string {
    // If syntax type hasn't changed, just update the alt text
    if (context.type === result.targetSyntax) {
        if (context.type === 'markdown') {
            return `![${result.altText}](:/${context.resourceId})`;
        } else { // html
            return updateHtmlAltText(context.syntax, result.altText);
        }
    }

    // If syntax type has changed, build the new syntax
    if (result.targetSyntax === 'markdown') {
        return `![${result.altText}](:/${context.resourceId})`;
    } else { // html
        return `<img src=":/${context.resourceId}" alt="${result.altText}" />`;
    }
}
