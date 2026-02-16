
export interface HotkeyConfig {
    code: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
    action: () => void;
    preventDefault?: boolean;
}

export class HotkeyManager {
    private hotkeys: HotkeyConfig[] = [];

    public register(config: HotkeyConfig) {
        this.hotkeys.push(config);
    }

    public handleKeyDown(e: KeyboardEvent) {
        // Ignore if typing in an input
        if (
            document.activeElement instanceof HTMLInputElement ||
            document.activeElement instanceof HTMLTextAreaElement ||
            (document.activeElement as HTMLElement)?.isContentEditable
        ) {
            return;
        }

        for (const hotkey of this.hotkeys) {
            const codeMatch = hotkey.code === e.code;
            const ctrlMatch = !!hotkey.ctrl === (e.ctrlKey || e.metaKey);
            const shiftMatch = !!hotkey.shift === e.shiftKey;
            const altMatch = !!hotkey.alt === e.altKey;

            if (codeMatch && ctrlMatch && shiftMatch && altMatch) {
                if (hotkey.preventDefault) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                hotkey.action();
                return true; // Handled
            }
        }
        return false;
    }

    public clear() {
        this.hotkeys = [];
    }
}

export const hotkeyManager = new HotkeyManager();
