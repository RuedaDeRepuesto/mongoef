import { _softDeleteRegistry } from './metadata';

/**
 * Activa Soft Delete para este modelo.
 * En lugar de eliminar documentos físicamente, `.delete()` setea el campo `deletedAt`.
 * Todos los queries de la colección excluyen automáticamente los documentos con `deletedAt` no nulo.
 * Para incluirlos en un query, usá `.withDeleted()` en el QueryBuilder.
 */
export function SoftDelete(target: any) {
    _softDeleteRegistry.add(target.name);
}
