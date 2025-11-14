export class Container {
  private services = new Map<string, any>();

  register<T>(key: string, factory: () => T): void {
    this.services.set(key, factory);
  }

  resolve<T>(key: string): T {
    const factory = this.services.get(key);
    if (!factory) {
      throw new Error(`Service ${key} not found`);
    }
    return factory() as T;
  }

  singleton<T>(key: string, factory: () => T): void {
    let instance: T | null = null;
    this.register(key, () => {
      if (!instance) {
        instance = factory();
      }
      return instance;
    });
  }
}

