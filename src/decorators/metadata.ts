export type Constructor = new (...args: any[]) => any;

export const _collectionNameRegistry: Map<Constructor, string> = new Map();
export const _jsonIgnoreRegistry: Map<Constructor, Set<string>> = new Map();
export const _columnRegistry: Map<Constructor, Record<string, string>> = new Map();
export const _notMappedRegistry: Map<Constructor, Set<string>> = new Map();
export const _foreignKeyRegistry: Map<Constructor, Record<string, ForeignKeyMeta>> = new Map();
export const _indexRegistry: Map<Constructor, IndexMeta[]> = new Map();
export const _softDeleteRegistry: Set<Constructor> = new Set();
export const _validationRegistry: Map<Constructor, Record<string, ValidationRule[]>> = new Map();

export interface ForeignKeyMeta {
    model: () => Constructor;
    localField: string;
}

export interface IndexMeta {
    key: Record<string, 1 | -1 | 'text'>;
    options?: Record<string, any>;
}

export interface ValidationRule {
    type: 'required' | 'maxLength' | 'minLength' | 'min' | 'max';
    value?: number;
    message?: string;
}

export function getCollectionName(ctor: Constructor): string {
    return _collectionNameRegistry.get(ctor) ?? ctor.name.toLowerCase();
}

export function getJsonIgnoreFields(ctor: Constructor): Set<string> {
    return _jsonIgnoreRegistry.get(ctor) ?? new Set();
}

export function getColumnMappings(ctor: Constructor): Record<string, string> {
    return _columnRegistry.get(ctor) ?? {};
}

export function getNotMappedFields(ctor: Constructor): Set<string> {
    return _notMappedRegistry.get(ctor) ?? new Set();
}

export function getForeignKeys(ctor: Constructor): Record<string, ForeignKeyMeta> {
    return _foreignKeyRegistry.get(ctor) ?? {};
}

export function getIndexes(ctor: Constructor): IndexMeta[] {
    return _indexRegistry.get(ctor) ?? [];
}

export function isSoftDelete(ctor: Constructor): boolean {
    return _softDeleteRegistry.has(ctor);
}

export function getValidationRules(ctor: Constructor): Record<string, ValidationRule[]> {
    return _validationRegistry.get(ctor) ?? {};
}
