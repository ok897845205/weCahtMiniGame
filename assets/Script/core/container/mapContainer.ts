export class MapContainer<TKey, TValue> {

    container = new Map();

    ensure(key: TKey, creator: () => TValue): TValue {

        if (!this.container.has(key)) {
            const item = creator();
            this.container.set(key, item);
            return item;
        }
        else {
            return this.container.get(key);
        }
    }

    get(key: TKey): TValue {
        return this.container.get(key);
    }

    delete(key: TKey): boolean {
        return this.container.delete(key);
    }

    clear() {
        this.container.clear();
    }
}