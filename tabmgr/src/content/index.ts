import { Message, TabInfo } from '../shared/types';
import * as UIManager from './ui-manager';

// This function will contain all our logic, preventing it from running multiple times.
function main() {
    // Prevent the script from initializing more than once on the same page.
    if ((window as any).altQSwitcherInitialized) {
        return;
    }
    (window as any).altQSwitcherInitialized = true;
    
    interface UIState {
      isVisible: boolean;
      tabs: TabInfo[];
      highlightedIndex: number;
    }
    
    const ui: UIState = {
      isVisible: false,
      tabs: [],
      highlightedIndex: 0,
    };

    // --- The Self-Cleaning Mechanism ---
    // Establish a port. We don't use it to send messages, only to detect disconnection.
    const port = chrome.runtime.connect({ name: 'content-script-lifecycle' });
    // When the extension reloads, this event will fire.
    port.onDisconnect.addListener(() => {
        // This is the crucial cleanup for "ghost" scripts.
        cleanupAndRemoveListeners();
    });

    // --- Main Logic ---
    chrome.runtime.onMessage.addListener((message: Message) => {
      if (message.type === 'shortcut-pressed') {
        handleShortcutPress();
      }
    });

    async function handleShortcutPress(): Promise<void> {
      if (!ui.isVisible) {
        // Use try-catch to handle the "context invalidated" error gracefully
        try {
            const tabs: TabInfo[] = await chrome.runtime.sendMessage({ type: 'request-tab-list' });
            if (!tabs || tabs.length === 0) return;

            ui.tabs = tabs;
            ui.highlightedIndex = tabs.length > 1 ? 1 : 0;
            ui.isVisible = true;

            UIManager.createSwitcherUI(ui.tabs, ui.highlightedIndex);
            
            window.addEventListener('keyup', handleAltUp, { capture: true });
            document.getElementById('alt-q-switcher-overlay')?.addEventListener('click', handleCancel);
        } catch (error) {
            if ((error as Error).message.includes('Extension context invalidated')) {
                console.log('Alt+Q: Stale content script detected. It will be cleaned up.');
                cleanupAndRemoveListeners();
            }
        }
      } else {
        ui.highlightedIndex = (ui.highlightedIndex + 1) % ui.tabs.length;
        UIManager.updateHighlight(ui.highlightedIndex);
      }
    }

    function handleAltUp(e: KeyboardEvent): void {
      if (e.key === 'Alt') {
        e.stopImmediatePropagation();
        e.preventDefault();

        if (ui.isVisible) {
          const selectedTab = ui.tabs[ui.highlightedIndex];
          if (selectedTab?.id) {
            const message: Message = { type: 'switch-to-tab', tabId: selectedTab.id };
            // No need for try-catch here as we are cleaning up immediately after.
            chrome.runtime.sendMessage(message);
          }
          cleanupAndRemoveListeners();
        }
      }
    }
    
    function handleCancel(e: MouseEvent): void {
        if ((e.target as HTMLElement).id === 'alt-q-switcher-overlay') {
            cleanupAndRemoveListeners();
        }
    }

    function cleanupAndRemoveListeners(): void {
      UIManager.cleanup();
      ui.isVisible = false;
      window.removeEventListener('keyup', handleAltUp, { capture: true });
      // The port will be disconnected automatically by the browser, no need to call port.disconnect()
    }
}

// Run the main function to start the script.
main();