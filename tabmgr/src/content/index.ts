import { Message, TabInfo } from '../shared/types';
import * as UIManager from './ui-manager';

function main() {
    if ((window as any).altQSwitcherInitialized) return;
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

    let altUpListenerAdded = false;
    let isProcessing = false;

    const port = chrome.runtime.connect({ name: 'content-script-lifecycle' });
    port.onDisconnect.addListener(() => { cleanupAndRemoveListeners(); });

    chrome.runtime.onMessage.addListener((message: Message) => {
      if (message.type === 'shortcut-pressed') {
        handleShortcutPress();
      }
    });

    async function handleShortcutPress(): Promise<void> {
      // Prevent multiple simultaneous calls
      if (isProcessing) return;
      
      if (!ui.isVisible) {
        isProcessing = true;
        try {
            const tabs: TabInfo[] = await chrome.runtime.sendMessage({ type: 'capture-and-get-list' });
           
            if (!tabs || tabs.length === 0) {
              isProcessing = false;
              return;
            }

            ui.tabs = tabs;
            ui.highlightedIndex = tabs.length > 1 ? 1 : 0;
            ui.isVisible = true;

            UIManager.createSwitcherUI(ui.tabs, ui.highlightedIndex);
            
            // Only add event listener once
            if (!altUpListenerAdded) {
              window.addEventListener('keyup', handleAltUp, { capture: true, once: false });
              altUpListenerAdded = true;
            }
            
            // Add click listener to overlay
            const overlay = document.getElementById('alt-q-switcher-overlay');
            if (overlay) {
              overlay.addEventListener('click', handleCancel);
            }

            isProcessing = false;
        } catch (error) {
            isProcessing = false;
            if ((error as Error).message.includes('Extension context invalidated')) {
                cleanupAndRemoveListeners();
            }
        }
      } else {
        // Cycle through tabs when popup is already visible
        ui.highlightedIndex = (ui.highlightedIndex + 1) % ui.tabs.length;
        UIManager.updateHighlight(ui.highlightedIndex);
      }
    }

    function handleAltUp(e: KeyboardEvent): void {
      if (e.key === 'Alt' || e.keyCode === 18) {
        e.stopImmediatePropagation();
        e.preventDefault();

        if (ui.isVisible) {
          const selectedTab = ui.tabs[ui.highlightedIndex];
          if (selectedTab?.id) {
            const message: Message = { type: 'switch-to-tab', tabId: selectedTab.id };
            chrome.runtime.sendMessage(message).catch(() => {
              // Ignore errors if extension context is invalidated
            });
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
      if (ui.isVisible) {
        UIManager.cleanup();
        ui.isVisible = false;
        ui.tabs = [];
        ui.highlightedIndex = 0;
      }
      
      if (altUpListenerAdded) {
        window.removeEventListener('keyup', handleAltUp, { capture: true });
        altUpListenerAdded = false;
      }
      
      isProcessing = false;
    }
}

main();