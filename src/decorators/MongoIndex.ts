import { _indexRegistry } from './metadata';

/**
 * Define un índice de MongoDB que se creará automáticamente cuando el DbContext se conecte.
 * Se puede aplicar múltiples veces en la misma clase para crear varios índices.
 *
 * @param key Definición del índice (ej: `{ email: 1 }`, `{ nombre: 'text' }`).
 * @param options Opciones del índice (ej: `{ unique: true }`, `{ sparse: true }`).
 *
 * @example
 * @CollectionName('users')
 * @Index({ email: 1 }, { unique: true })
 * @Index({ nombre: 'text' })
 * class User extends Model { ... }
 */
export function Index(key: Record<string, 1 | -1 | 'text'>, options?: Record<string, any>) {
    return function (target: any) {
        if (!_indexRegistry.has(target)) {
            _indexRegistry.set(target, []);
        }
        _indexRegistry.get(target)!.push({ key, options });
    };
}
