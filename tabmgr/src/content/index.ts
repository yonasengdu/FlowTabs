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

    const port = chrome.runtime.connect({ name: 'content-script-lifecycle' });
    port.onDisconnect.addListener(() => { cleanupAndRemoveListeners(); });

    chrome.runtime.onMessage.addListener((message: Message) => {
      if (message.type === 'shortcut-pressed') {
        handleShortcutPress();
      }
    });

    async function handleShortcutPress(): Promise<void> {
      if (!ui.isVisible) {
        try {
         
            const tabs: TabInfo[] = await chrome.runtime.sendMessage({ type: 'capture-and-get-list' });
           
            if (!tabs || tabs.length === 0) return;

            ui.tabs = tabs;
            ui.highlightedIndex = tabs.length > 1 ? 1 : 0;
            ui.isVisible = true;

            UIManager.createSwitcherUI(ui.tabs, ui.highlightedIndex);
            
            window.addEventListener('keyup', handleAltUp, { capture: true });
            document.getElementById('alt-q-switcher-overlay')?.addEventListener('click', handleCancel);

        } catch (error) {
            if ((error as Error).message.includes('Extension context invalidated')) {
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
      
            cleanupAndRemoveListeners();

            const message: Message = { type: 'switch-to-tab', tabId: selectedTab.id };
            chrome.runtime.sendMessage(message);
          } else {
            cleanupAndRemoveListeners();
          }
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
    }
}

main();