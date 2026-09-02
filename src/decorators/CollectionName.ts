import { _collectionNameRegistry } from './metadata';

/**
 * Define el nombre de la colección en MongoDB para este modelo.
 * Si no se aplica, se usa el nombre de la clase en minúsculas.
 * @param name Nombre de la colección en MongoDB.
 */
export function CollectionName(name: string) {
    return function (target: any) {
        _collectionNameRegistry[target.name] = name;
    };
}
