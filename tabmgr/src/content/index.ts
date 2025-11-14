import { Message } from '../shared/types';
import * as UIManager from './ui-manager';
import { StateManager } from './switcher-state';
import { KEY_CODES, INIT_FLAG } from './constants';

class SwitcherController {
  private stateManager = new StateManager();
  private altUpListenerAdded = false;
  private isProcessing = false;
  private port: chrome.runtime.Port;

  constructor() {
    this.port = chrome.runtime.connect({ name: 'content-script-lifecycle' });
    this.port.onDisconnect.addListener(() => this.cleanup());
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message: Message) => {
      if (message.type === 'shortcut-pressed') {
        this.handleShortcutPress();
      }
    });
  }

  private async handleShortcutPress(): Promise<void> {
    if (this.isProcessing) return;

    if (!this.stateManager.isVisible()) {
      await this.showSwitcher();
    } else {
      this.cycleHighlight();
    }
  }

  private async showSwitcher(): Promise<void> {
    this.isProcessing = true;
    
    try {
      const tabs = await this.fetchTabs();
      if (!tabs || tabs.length === 0) {
        this.isProcessing = false;
        return;
      }

      this.stateManager.setTabs(tabs);
      this.stateManager.show();
      
      UIManager.createSwitcherUI(tabs, this.stateManager.getState().highlightedIndex);
      
      this.setupEventListeners();
      this.isProcessing = false;
    } catch (error) {
      this.isProcessing = false;
      if ((error as Error).message.includes('Extension context invalidated')) {
        this.cleanup();
      }
    }
  }

  private async fetchTabs(): Promise<any[]> {
    return chrome.runtime.sendMessage({ type: 'capture-and-get-list' });
  }

  private setupEventListeners(): void {
    if (!this.altUpListenerAdded) {
      window.addEventListener('keyup', this.handleAltUp.bind(this), { capture: true });
      this.altUpListenerAdded = true;
    }

    const overlay = document.getElementById('alt-q-switcher-overlay');
    if (overlay) {
      overlay.addEventListener('click', this.handleCancel.bind(this));
    }
  }

  private handleAltUp(e: KeyboardEvent): void {
    if (!this.isAltKey(e)) return;

    e.stopImmediatePropagation();
    e.preventDefault();

    if (this.stateManager.isVisible()) {
      this.selectTab();
    }
  }

  private isAltKey(e: KeyboardEvent): boolean {
    return e.key === KEY_CODES.ALT || e.keyCode === KEY_CODES.ALT_KEYCODE;
  }

  private selectTab(): void {
    const selectedTab = this.stateManager.getHighlightedTab();
    if (selectedTab?.id) {
      const message: Message = { type: 'switch-to-tab', tabId: selectedTab.id };
      chrome.runtime.sendMessage(message).catch(() => {
        // Ignore errors if extension context is invalidated
      });
    }
    this.cleanup();
  }

  private handleCancel(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.id === 'alt-q-switcher-overlay') {
      this.cleanup();
    }
  }

  private cycleHighlight(): void {
    this.stateManager.cycleHighlight();
    UIManager.updateHighlight(this.stateManager.getState().highlightedIndex);
  }

  private cleanup(): void {
    if (this.stateManager.isVisible()) {
      UIManager.cleanup();
      this.stateManager.hide();
    }

    if (this.altUpListenerAdded) {
      window.removeEventListener('keyup', this.handleAltUp.bind(this), { capture: true });
      this.altUpListenerAdded = false;
    }

    this.isProcessing = false;
  }
}

function initialize(): void {
  if ((window as any)[INIT_FLAG]) return;
  (window as any)[INIT_FLAG] = true;
  
  new SwitcherController();
}

initialize();
