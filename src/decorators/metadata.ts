export const _collectionNameRegistry: Record<string, string> = {};
export const _jsonIgnoreRegistry: Record<string, Set<string>> = {};
export const _columnRegistry: Record<string, Record<string, string>> = {};
export const _notMappedRegistry: Record<string, Set<string>> = {};
export const _foreignKeyRegistry: Record<string, Record<string, ForeignKeyMeta>> = {};
export const _indexRegistry: Record<string, IndexMeta[]> = {};
export const _softDeleteRegistry: Set<string> = new Set();

export interface ForeignKeyMeta {
    model: () => new () => any;
    localField: string;
}

export interface IndexMeta {
    key: Record<string, 1 | -1 | 'text'>;
    options?: Record<string, any>;
}

export function getCollectionName(className: string): string {
    return _collectionNameRegistry[className] ?? className.toLowerCase();
}

export function getJsonIgnoreFields(className: string): Set<string> {
    return _jsonIgnoreRegistry[className] ?? new Set();
}

export function getColumnMappings(className: string): Record<string, string> {
    return _columnRegistry[className] ?? {};
}

export function getNotMappedFields(className: string): Set<string> {
    return _notMappedRegistry[className] ?? new Set();
}

export function getForeignKeys(className: string): Record<string, ForeignKeyMeta> {
    return _foreignKeyRegistry[className] ?? {};
}

export function getIndexes(className: string): IndexMeta[] {
    return _indexRegistry[className] ?? [];
}

export function isSoftDelete(className: string): boolean {
    return _softDeleteRegistry.has(className);
}
