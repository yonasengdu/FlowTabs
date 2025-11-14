import { IThumbnailRepository } from '../../core/repositories/IThumbnailRepository';
import { IStorageRepository } from '../../core/repositories/IStorageRepository';

export class ThumbnailRepository implements IThumbnailRepository {
  private cache = new Map<number, string>();

  constructor(private storageRepository: IStorageRepository) {}

  async getThumbnail(tabId: number): Promise<string | undefined> {
    // Check cache first
    const cached = this.cache.get(tabId);
    if (cached) return cached;

    // Check storage
    const thumbnails = await this.storageRepository.getThumbnails();
    const thumbnail = thumbnails[tabId.toString()];
    if (thumbnail) {
      this.cache.set(tabId, thumbnail);
    }
    return thumbnail;
  }

  async saveThumbnail(tabId: number, thumbnail: string): Promise<void> {
    this.cache.set(tabId, thumbnail);
    await this.storageRepository.saveThumbnail(tabId, thumbnail);
  }

  async removeThumbnail(tabId: number): Promise<void> {
    this.cache.delete(tabId);
    await this.storageRepository.removeThumbnail(tabId);
  }

  getCachedThumbnail(tabId: number): string | undefined {
    return this.cache.get(tabId);
  }

  cacheThumbnail(tabId: number, thumbnail: string): void {
    this.cache.set(tabId, thumbnail);
  }
}

