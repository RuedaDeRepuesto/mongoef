import { _foreignKeyRegistry } from './metadata';

/**
 * Define una relación entre este modelo y otro, usando un campo local como clave foránea.
 * Permite hidratación automática de la propiedad con `.include('campo')` en el QueryBuilder,
 * que internamente usa `$lookup` + `$unwind` en el pipeline de agregación.
 *
 * @param model Factory que retorna el constructor del modelo relacionado. Se usa una factory
 *              para evitar problemas de referencias circulares entre modelos.
 * @param localField Campo en este modelo que contiene el ObjectId de referencia.
 *
 * @example
 * class Order extends Model {
 *     userId: ObjectId = new ObjectId();
 *
 *     @ForeignKey(() => User, 'userId')
 *     user?: User;
 * }
 *
 * const orders = await context.orders.query().include('user').toList();
 */
export function ForeignKey(model: () => new () => any, localField: string) {
    return function (target: any, propertyKey: string) {
        const ctor = target.constructor;
        if (!_foreignKeyRegistry.has(ctor)) {
            _foreignKeyRegistry.set(ctor, {});
        }
        _foreignKeyRegistry.get(ctor)![propertyKey] = { model, localField };
    };
}
