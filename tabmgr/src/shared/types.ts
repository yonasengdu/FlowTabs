
export type Message = 
  | { type: 'shortcut-pressed' }
  | { type: 'request-tab-list' }
  | { type: 'switch-to-tab'; tabId: number };


export interface TabInfo {
  id?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  snapshotUrl?: string;
}