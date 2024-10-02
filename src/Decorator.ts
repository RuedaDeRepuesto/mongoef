import { _collectionNameRegistry } from "./DbContext";

export function CollectionName(name: string) {
    return function (target: any) {
        const className = target.name;
        _collectionNameRegistry[className] = name; // Almacena la asociación
    };
}