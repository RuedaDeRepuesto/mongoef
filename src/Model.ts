import { ObjectId } from 'mongodb';
import { DbContext } from './DbContext';
import {
    getCollectionName,
    getColumnMappings,
    getJsonIgnoreFields,
    getNotMappedFields,
    isSoftDelete,
} from './decorators/metadata';

export abstract class Model {
    _id: ObjectId | undefined;

    /**
     * Persiste el modelo en MongoDB.
     * Si tiene `_id`, realiza un `updateOne`; de lo contrario, hace un `insertOne` y asigna el `_id`.
     * Respeta los decoradores @Column (mapeo de nombres) y @NotMapped (campos no persistidos).
     * @param context El DbContext activo.
     */
    public async save(context: DbContext): Promise<void> {
        const collection = context.connection.collection(this.getCollectionName());
        const className = this.constructor.name;
        const columnMappings = getColumnMappings(className);
        const notMapped = getNotMappedFields(className);

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
        const collection = context.connection.collection(this.getCollectionName());
        const className = this.constructor.name;

        if (isSoftDelete(className)) {
            const r = await collection.updateOne({ _id: this._id }, { $set: { deletedAt: new Date() } });
            return r.modifiedCount;
        }

        const r = await collection.deleteOne({ _id: this._id });
        return r.deletedCount;
    }

    /**
     * Serializa el modelo a un objeto plano, excluyendo las propiedades marcadas con @JsonIgnore.
     * Es llamado automáticamente por `JSON.stringify()`.
     */
    public toJSON(): Record<string, any> {
        const className = this.constructor.name;
        const jsonIgnore = getJsonIgnoreFields(className);
        const result: Record<string, any> = { _id: this._id };

        for (const key of Object.keys(this)) {
            if (key.startsWith('_')) continue;
            if (jsonIgnore.has(key)) continue;
            result[key] = (this as any)[key];
        }

        return result;
    }

    protected getCollectionName(): string {
        return getCollectionName(this.constructor.name);
    }
}
