import { _columnRegistry } from './metadata';

/**
 * Mapea esta propiedad a un nombre de campo diferente en MongoDB.
 * Al guardar, usa el nombre del campo dado. Al leer, mapea de vuelta a la propiedad TS.
 * @param name Nombre del campo en MongoDB.
 */
export function Column(name: string) {
    return function (target: any, propertyKey: string) {
        const className = target.constructor.name;
        if (!_columnRegistry[className]) {
            _columnRegistry[className] = {};
        }
        _columnRegistry[className][propertyKey] = name;
    };
}
