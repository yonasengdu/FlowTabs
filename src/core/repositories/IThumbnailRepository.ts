export interface IThumbnailRepository {
  getThumbnail(tabId: number): Promise<string | undefined>;
  saveThumbnail(tabId: number, thumbnail: string): Promise<void>;
  removeThumbnail(tabId: number): Promise<void>;
  getCachedThumbnail(tabId: number): string | undefined;
  cacheThumbnail(tabId: number, thumbnail: string): void;
}

