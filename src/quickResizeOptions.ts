import { ResizeDialogResult } from './types';

export const QUICK_RESIZE_OPTIONS_DEFAULT = '100%, 75%, 50%, 33%, 25%';
export const QUICK_RESIZE_SLOT_LIMIT = 5;

export const QUICK_RESIZE_SLOTS = [
    { commandName: 'resize100', accelerator: 'CmdOrCtrl+Shift+1' },
    { commandName: 'resize75', accelerator: 'CmdOrCtrl+Shift+2' },
    { commandName: 'resize50', accelerator: 'CmdOrCtrl+Shift+3' },
    { commandName: 'resize33', accelerator: 'CmdOrCtrl+Shift+4' },
    { commandName: 'resize25', accelerator: 'CmdOrCtrl+Shift+5' },
] as const;

export type QuickResizeOption =
    | {
          kind: 'percentage';
          value: number;
          label: string;
      }
    | {
          kind: 'pixels';
          value: number;
          label: string;
      };

export function parseQuickResizeOptions(rawOptions: string): QuickResizeOption[] {
    const tokens = rawOptions
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token.length > 0);

    if (tokens.length === 0) {
        throw new Error('Quick resize options must include at least one value.');
    }

    if (tokens.length > QUICK_RESIZE_SLOT_LIMIT) {
        throw new Error(`Quick resize options support at most ${QUICK_RESIZE_SLOT_LIMIT} values.`);
    }

    return tokens.map(parseQuickResizeToken);
}

export function normalizeQuickResizeOptionsSetting(rawOptions: string): string {
    const normalizedTokens = rawOptions
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
        .reduce<string[]>((tokens, token) => {
            if (tokens.length >= QUICK_RESIZE_SLOT_LIMIT) {
                return tokens;
            }

            try {
                tokens.push(parseQuickResizeToken(token).label);
            } catch {
                // Invalid entries are discarded so valid quick resize slots still work.
            }

            return tokens;
        }, []);

    if (normalizedTokens.length === 0) {
        return QUICK_RESIZE_OPTIONS_DEFAULT;
    }

    return normalizedTokens.join(', ');
}

export function tryParseQuickResizeOptions(rawOptions: string): QuickResizeOption[] {
    try {
        return parseQuickResizeOptions(rawOptions);
    } catch {
        return [];
    }
}

export function getQuickResizeLabel(option: QuickResizeOption): string {
    return `Resize ${option.label}`;
}

export function buildQuickResizeResult(option: QuickResizeOption, altText: string): ResizeDialogResult {
    if (option.kind === 'percentage') {
        return {
            targetSyntax: option.value === 100 ? 'markdown' : 'html',
            altText,
            resizeMode: 'percentage',
            percentage: option.value,
        };
    }

    return {
        targetSyntax: 'html',
        altText,
        resizeMode: 'absolute',
        absoluteWidth: option.value,
    };
}

export function getQuickResizeSuccessMessage(option: QuickResizeOption): string {
    if (option.kind === 'percentage' && option.value === 100) {
        return 'Custom size removed - converted to Markdown syntax.';
    }

    return `Image resized to ${option.label}.`;
}

function parseQuickResizeToken(token: string): QuickResizeOption {
    const match = /^(\d+)(%|px)$/i.exec(token);
    if (!match) {
        throw new Error(
            `Invalid quick resize option "${token}". Use positive whole-number values like 75% or 300px.`
        );
    }

    const value = Number.parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (value <= 0) {
        throw new Error(`Invalid quick resize option "${token}". Values must be greater than zero.`);
    }

    if (unit === '%' && value > 500) {
        throw new Error(`Invalid quick resize option "${token}". Percentages must be between 1% and 500%.`);
    }

    if (unit === '%') {
        return {
            kind: 'percentage',
            value,
            label: `${value}%`,
        };
    }

    return {
        kind: 'pixels',
        value,
        label: `${value}px`,
    };
}
