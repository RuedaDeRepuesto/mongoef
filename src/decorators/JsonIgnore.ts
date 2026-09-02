import { _jsonIgnoreRegistry } from './metadata';

/**
 * Excluye esta propiedad al serializar el modelo con JSON.stringify o toJSON().
 * La propiedad se sigue persistiendo en MongoDB; solo se oculta en la serialización JSON.
 * Útil para campos sensibles como contraseñas o tokens internos.
 */
export function JsonIgnore(target: any, propertyKey: string) {
    const className = target.constructor.name;
    if (!_jsonIgnoreRegistry[className]) {
        _jsonIgnoreRegistry[className] = new Set();
    }
    _jsonIgnoreRegistry[className].add(propertyKey);
}
