import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { getImageAtCursor } from '../../src/editor/editorImageQueries';
import type { ImageDetails, ImageSyntax } from '../../src/shared/types';

/**
 * Extract image details from text the way the editor does: parse it with the
 * GFM grammar Joplin's CM6 editor uses, then run the real syntax-tree lookup.
 *
 * Returns null unless the whole text is a single image of the expected syntax.
 */
export function extractImageDetails(text: string, syntaxType: ImageSyntax): ImageDetails | null {
    const state = EditorState.create({ doc: text, extensions: [markdown({ base: markdownLanguage })] });
    const result = getImageAtCursor(state);
    if (result?.syntax !== text || result.type !== syntaxType) return null;

    return {
        type: result.type,
        syntax: result.syntax,
        source: result.source,
        sourceType: result.sourceType,
        altText: result.altText,
        title: result.title,
    };
}
