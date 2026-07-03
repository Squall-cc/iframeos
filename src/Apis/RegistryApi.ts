export type RegistryValue = string | number | boolean | object | null | any[];

export interface RegistryRecord {
  path: string;
  values: Record<string, RegistryValue>;
}
export class RegistryValueHandle {
  private _value: RegistryValue = null;
  private _loaded = false;

  constructor(loader: () => Promise<RegistryValue>) {
    loader().then((v) => {
      this._value = v;
      this._loaded = true;
    });
  }

  get value(): RegistryValue {
    return this._value;
  }

  get type(): string {
    if (this._value === null) return "null";
    if (Array.isArray(this._value)) return "array";
    return typeof this._value;
  }

  get loaded(): boolean {
    return this._loaded;
  }
}

export class RegistryInstanceAccess {
  private db: IDBDatabase | null = null;
  private ready: Promise<void>;

  constructor() {
    this.ready = new Promise((resolve, reject) => {
      const req = indexedDB.open("iFSInternalRegistryDataBase", 1);

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("registry")) {
          db.createObjectStore("registry", { keyPath: "path" });
        }
      };

      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve();
      };

      req.onerror = (e) => reject(e);
    });
  }

  getKey(path: string): RegistryKey {
    return new RegistryKey(this, path);
  }

  async _load(path: string): Promise<RegistryRecord | null> {
    await this.ready;
    return new Promise((resolve) => {
      const tx = this.db!.transaction("registry", "readonly");
      const store = tx.objectStore("registry");
      const req = store.get(path);

      req.onsuccess = () => resolve((req.result as RegistryRecord) || null);
      req.onerror = () => resolve(null);
    });
  }
  async _save(record: RegistryRecord): Promise<void> {
    await this.ready;
    const tx = this.db!.transaction("registry", "readwrite");
    const store = tx.objectStore("registry");
    store.put(record);
  }

  get _db(): IDBDatabase {
    return this.db!;
  }

  async _write(
    path: string,
    name: string,
    value: RegistryValue,
  ): Promise<void> {
    await this.ready;

    const existing = await this._load(path);
    const obj: RegistryRecord = existing || { path, values: {} };
    obj.values[name] = value;

    const tx = this.db!.transaction("registry", "readwrite");
    const store = tx.objectStore("registry");
    store.put(obj);
  }

  async _deleteValue(path: string, name: string): Promise<void> {
    await this.ready;

    const existing = await this._load(path);
    if (!existing) return;

    delete existing.values[name];

    const tx = this.db!.transaction("registry", "readwrite");
    const store = tx.objectStore("registry");
    store.put(existing);
  }

  async _deleteKey(path: string): Promise<void> {
    await this.ready;

    const tx = this.db!.transaction("registry", "readwrite");
    const store = tx.objectStore("registry");
    store.delete(path);
  }
}

export class RegistryKey {
  public path: string;

  constructor(
    private instance: RegistryInstanceAccess,
    path: string,
  ) {
    this.path = this._normalize(path);
  }

  private _normalize(path: string): string {
    if (!path) return "";

    const parts = path.split("/").filter((p) => p.length > 0);
    const stack: string[] = [];

    for (const p of parts) {
      if (p === ".") continue;
      if (p === "..") {
        stack.pop();
        continue;
      }
      stack.push(p);
    }

    return stack.join("/");
  }

  private _resolve(sub: string): RegistryKey {
    if (!sub || sub === ".") return this;
    const combined = this.path ? `${this.path}/${sub}` : sub;
    return new RegistryKey(this.instance, combined);
  }

  getKey(sub: string): RegistryKey {
    return this._resolve(sub);
  }

  getValue(name: string): RegistryValueHandle {
    return new RegistryValueHandle(async () => {
      const obj = await this.instance._load(this.path);
      if (!obj) return null;
      return obj.values[name] ?? null;
    });
  }

  setValue(name: string, value: RegistryValue): void {
    this.instance._write(this.path, name, value);
  }

  deleteValue(name: string): void {
    this.instance._deleteValue(this.path, name);
  }

  deleteKey(): void {
    this.instance._deleteKey(this.path);
  }
  list(): { keys: string[]; values: string[] } {
    const result: { keys: string[]; values: string[] } = {
      keys: [],
      values: [],
    };

    (async () => {
      const current = await this.instance._load(this.path);
      if (current) {
        result.values = Object.keys(current.values);
      }
      const tx = this.instance._db.transaction("registry", "readonly");
      const store = tx.objectStore("registry");
      const req = store.getAll();

      req.onsuccess = () => {
        const all = req.result as RegistryRecord[];
        const prefix = this.path ? this.path + "/" : "";

        result.keys = all
          .map((e) => e.path)
          .filter((p) => p.startsWith(prefix) && p !== this.path)
          .map((p) => p.slice(prefix.length))
          .filter((p) => !p.includes("/"));
      };
    })();

    return result;
  }

  createKey(): void {
    (async () => {
      const existing = await this.instance._load(this.path);
      if (existing) return;

      await this.instance._save({
        path: this.path,
        values: {},
      });
    })();
  }
}
