import { ObjectId } from 'mongodb';
import { DbContext } from './DbContext';
import {
    Constructor,
    getCollectionName,
    getColumnMappings,
    getJsonIgnoreFields,
    getNotMappedFields,
    getValidationRules,
    isSoftDelete,
} from './decorators/metadata';

export abstract class Model {
    _id: ObjectId | undefined;

    /**
     * Persiste el modelo en MongoDB.
     * Si tiene `_id`, realiza un `updateOne`; de lo contrario, hace un `insertOne` y asigna el `_id`.
     * Respeta los decoradores @Column (mapeo de nombres) y @NotMapped (campos no persistidos).
     * Ejecuta las validaciones definidas con decoradores antes de persistir.
     * @param context El DbContext activo.
     */
    public async save(context: DbContext): Promise<void> {
        const errors = this.validate();
        if (errors.length > 0) {
            throw new Error(`[mongoef] Validación fallida: ${errors.join(', ')}`);
        }

        const ctor = this.constructor as Constructor;
        const collection = context.connection.collection(getCollectionName(ctor));
        const columnMappings = getColumnMappings(ctor);
        const notMapped = getNotMappedFields(ctor);

        const dataToSave: Record<string, any> = {};

        for (const key of Object.keys(this)) {
            if (key.startsWith('_')) continue;
            if (notMapped.has(key)) continue;
            const mongoField = columnMappings[key] ?? key;
            dataToSave[mongoField] = (this as any)[key];
        }

        if (this._id) {
            await collection.updateOne({ _id: this._id }, { $set: dataToSave });
        } else {
            const result = await collection.insertOne(dataToSave);
            this._id = result.insertedId;
        }
    }

    /**
     * Elimina el documento de MongoDB.
     * Si el modelo usa @SoftDelete, setea `deletedAt` con la fecha actual en lugar de borrar físicamente.
     * @param context El DbContext activo.
     * @returns Cantidad de documentos afectados.
     */
    public async delete(context: DbContext): Promise<number> {
        const ctor = this.constructor as Constructor;
        const collection = context.connection.collection(getCollectionName(ctor));

        if (isSoftDelete(ctor)) {
            const r = await collection.updateOne({ _id: this._id }, { $set: { deletedAt: new Date() } });
            return r.modifiedCount;
        }

        const r = await collection.deleteOne({ _id: this._id });
        return r.deletedCount;
    }

    /**
     * Valida el modelo según los decoradores de validación (@Required, @MaxLength, etc.).
     * @returns Array de mensajes de error. Vacío si el modelo es válido.
     */
    public validate(): string[] {
        const ctor = this.constructor as Constructor;
        const rules = getValidationRules(ctor);
        const errors: string[] = [];

        for (const [field, fieldRules] of Object.entries(rules)) {
            const value = (this as any)[field];

            for (const rule of fieldRules) {
                switch (rule.type) {
                    case 'required':
                        if (value === null || value === undefined || value === '') {
                            errors.push(rule.message ?? `${field} es requerido`);
                        }
                        break;
                    case 'maxLength':
                        if (typeof value === 'string' && value.length > rule.value!) {
                            errors.push(rule.message ?? `${field} excede el largo máximo de ${rule.value}`);
                        }
                        break;
                    case 'minLength':
                        if (typeof value === 'string' && value !== '' && value.length < rule.value!) {
                            errors.push(rule.message ?? `${field} no alcanza el largo mínimo de ${rule.value}`);
                        }
                        break;
                    case 'min':
                        if (typeof value === 'number' && value < rule.value!) {
                            errors.push(rule.message ?? `${field} debe ser al menos ${rule.value}`);
                        }
                        break;
                    case 'max':
                        if (typeof value === 'number' && value > rule.value!) {
                            errors.push(rule.message ?? `${field} debe ser como máximo ${rule.value}`);
                        }
                        break;
                }
            }
        }

        return errors;
    }

    /**
     * Serializa el modelo a un objeto plano, excluyendo las propiedades marcadas con @JsonIgnore.
     * Es llamado automáticamente por `JSON.stringify()`.
     */
    public toJSON(): Record<string, any> {
        const ctor = this.constructor as Constructor;
        const jsonIgnore = getJsonIgnoreFields(ctor);
        const result: Record<string, any> = { _id: this._id };

        for (const key of Object.keys(this)) {
            if (key.startsWith('_')) continue;
            if (jsonIgnore.has(key)) continue;
            result[key] = (this as any)[key];
        }

        return result;
    }

    protected getCollectionName(): string {
        return getCollectionName(this.constructor as Constructor);
    }
}
