import { _notMappedRegistry } from './metadata';

/**
 * Marca esta propiedad como no persistida en MongoDB.
 * La propiedad existe en el modelo en memoria pero nunca se guarda ni se lee de la base de datos.
 * Útil para propiedades calculadas o de uso temporal en la aplicación.
 */
export function NotMapped(target: any, propertyKey: string) {
    const className = target.constructor.name;
    if (!_notMappedRegistry[className]) {
        _notMappedRegistry[className] = new Set();
    }
    _notMappedRegistry[className].add(propertyKey);
}
