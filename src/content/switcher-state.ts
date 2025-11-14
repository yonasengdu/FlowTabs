import { TabInfo } from '../shared/types';

export interface SwitcherState {
  isVisible: boolean;
  tabs: TabInfo[];
  highlightedIndex: number;
}

export class StateManager {
  private state: SwitcherState = {
    isVisible: false,
    tabs: [],
    highlightedIndex: 0,
  };

  getState(): SwitcherState {
    return { ...this.state };
  }

  setTabs(tabs: TabInfo[]): void {
    this.state.tabs = tabs;
    this.state.highlightedIndex = tabs.length > 1 ? 1 : 0;
  }

  setHighlightedIndex(index: number): void {
    this.state.highlightedIndex = index;
  }

  cycleHighlight(): void {
    if (this.state.tabs.length === 0) return;
    this.state.highlightedIndex = (this.state.highlightedIndex + 1) % this.state.tabs.length;
  }

  show(): void {
    this.state.isVisible = true;
  }

  hide(): void {
    this.state.isVisible = false;
    this.state.tabs = [];
    this.state.highlightedIndex = 0;
  }

  isVisible(): boolean {
    return this.state.isVisible;
  }

  getHighlightedTab(): TabInfo | undefined {
    return this.state.tabs[this.state.highlightedIndex];
  }
}

