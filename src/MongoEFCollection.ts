import { Collection, Document, Filter, FindOptions, ObjectId } from 'mongodb';
import { Model } from './Model';
import { QueryBuilder, QueryExecutor } from './QueryBuilder';
import {
    Constructor,
    getCollectionName,
    getColumnMappings,
    getForeignKeys,
    getNotMappedFields,
    isSoftDelete,
} from './decorators/metadata';

export class MongoEFCollection<T extends Model> {
    collection!: Collection;

    constructor(private readonly modelType: { new(): T }) {}

    /**
     * Retorna el nombre de la colección en MongoDB para este tipo de modelo.
     */
    public getCollectionName(): string {
        return getCollectionName(this.modelType);
    }

    /**
     * Retorna el constructor del modelo. Usado internamente por DbContext para leer metadata.
     */
    public getModelType(): Constructor {
        return this.modelType;
    }

    /**
     * Retorna un QueryBuilder para construir consultas de forma fluida.
     * Soporta encadenamiento de `.where()`, `.orderBy()`, `.skip()`, `.take()`, `.include()`, `.withDeleted()`.
     * @param filter Filtro inicial opcional.
     */
    public query(filter?: Filter<Document>): QueryBuilder<T> {
        const executor: QueryExecutor<T> = {
            execute: (b) => this._executeQuery(b),
            count: (b) => this._executeCount(b),
        };
        const builder = new QueryBuilder<T>(executor);
        if (filter) builder.where(filter);
        return builder;
    }

    /**
     * Retorna todos los documentos de la colección.
     * Los documentos con Soft Delete activo son excluidos automáticamente.
     */
    public async all(): Promise<T[]> {
        return this._findRaw(this._applySoftDeleteFilter({}));
    }

    /**
     * Retorna los documentos que cumplen con el filtro dado.
     * Los documentos con Soft Delete activo son excluidos automáticamente.
     * @param filter Filtro de MongoDB.
     * @param options Opciones adicionales de la consulta (sort, skip, limit, projection, etc.).
     */
    public async filter(filter: Filter<Document>, options?: FindOptions): Promise<T[]> {
        return this._findRaw(this._applySoftDeleteFilter(filter), options);
    }

    /**
     * Busca un documento por su `_id` o por un filtro personalizado.
     * @param id `ObjectId`, string con el id, o un filtro de MongoDB.
     * @param throwIfNotExists Si es `true`, lanza un error cuando no se encuentra el documento.
     * @returns El modelo encontrado o `null`.
     */
    public async get(id: string | ObjectId | Filter<Document>, throwIfNotExists = false): Promise<T | null> {
        let rawFilter: Filter<Document>;

        if (id instanceof ObjectId) {
            rawFilter = { _id: id };
        } else if (typeof id === 'string') {
            rawFilter = { _id: new ObjectId(id) };
        } else {
            rawFilter = id;
        }

        const results = await this._findRaw(this._applySoftDeleteFilter(rawFilter));

        if (results.length > 0) return results[0];

        if (throwIfNotExists) {
            throw new Error(`[mongoef] Id ${String(id)} no encontrado en la colección ${this.getCollectionName()}.`);
        }

        return null;
    }

    /**
     * Busca un documento por id o retorna una nueva instancia del modelo si no existe.
     * @param id `ObjectId`, string con el id, o un filtro de MongoDB.
     */
    public async getOrNew(id: string | ObjectId | Filter<Document>): Promise<T> {
        const item = await this.get(id);
        return item ?? new this.modelType();
    }

    /**
     * Elimina uno o varios documentos.
     * Si el modelo usa @SoftDelete, setea `deletedAt` en lugar de borrar físicamente.
     * Cuando se pasa un array, usa `deleteMany` / `updateMany` en una sola operación.
     * @param obj Un modelo, un `ObjectId`, o un array de modelos.
     * @returns Cantidad de documentos eliminados o afectados.
     */
    public async delete(obj: T | T[] | ObjectId): Promise<number> {
        const softDelete = isSoftDelete(this.modelType);

        if (Array.isArray(obj)) {
            const ids = obj.map(item => item._id).filter((id): id is ObjectId => id !== undefined);
            if (softDelete) {
                const r = await this.collection.updateMany({ _id: { $in: ids } }, { $set: { deletedAt: new Date() } });
                return r.modifiedCount;
            }
            const r = await this.collection.deleteMany({ _id: { $in: ids } });
            return r.deletedCount;
        }

        if (obj instanceof ObjectId) {
            if (softDelete) {
                const r = await this.collection.updateOne({ _id: obj }, { $set: { deletedAt: new Date() } });
                return r.modifiedCount;
            }
            const r = await this.collection.deleteOne({ _id: obj });
            return r.deletedCount;
        }

        if (obj instanceof this.modelType) {
            if (softDelete) {
                const r = await this.collection.updateOne({ _id: obj._id }, { $set: { deletedAt: new Date() } });
                return r.modifiedCount;
            }
            const r = await this.collection.deleteOne({ _id: obj._id });
            return r.deletedCount;
        }

        throw new Error('[mongoef] Tipo de argumento inválido para delete().');
    }

    private async _executeQuery(builder: QueryBuilder<T>): Promise<T[]> {
        const filter = this._applySoftDeleteFilter(builder.getFilter(), builder.isWithDeleted());

        if (builder.getIncludes().length > 0) {
            return this._executeAggregation(filter, builder);
        }

        const options: FindOptions = {};
        if (builder.getSort()) options.sort = builder.getSort();
        if (builder.getSkip() !== undefined) options.skip = builder.getSkip();
        if (builder.getLimit() !== undefined) options.limit = builder.getLimit();

        return this._findRaw(filter, options);
    }

    private async _executeCount(builder: QueryBuilder<T>): Promise<number> {
        const filter = this._applySoftDeleteFilter(builder.getFilter(), builder.isWithDeleted());
        return this.collection.countDocuments(filter);
    }

    private async _executeAggregation(filter: Filter<Document>, builder: QueryBuilder<T>): Promise<T[]> {
        const foreignKeys = getForeignKeys(this.modelType);
        const pipeline: any[] = [];

        if (Object.keys(filter).length > 0) {
            pipeline.push({ $match: filter });
        }

        for (const field of builder.getIncludes()) {
            const fkMeta = foreignKeys[field];
            if (!fkMeta) continue;

            const RelatedClass = fkMeta.model();
            pipeline.push({
                $lookup: {
                    from: getCollectionName(RelatedClass),
                    localField: fkMeta.localField,
                    foreignField: '_id',
                    as: field,
                },
            });
            pipeline.push({ $unwind: { path: `$${field}`, preserveNullAndEmptyArrays: true } });
        }

        if (builder.getSort()) pipeline.push({ $sort: builder.getSort() as any });
        if (builder.getSkip() !== undefined) pipeline.push({ $skip: builder.getSkip()! });
        if (builder.getLimit() !== undefined) pipeline.push({ $limit: builder.getLimit()! });

        const array = await this.collection.aggregate(pipeline).toArray();
        return this._mapDocuments(array, builder.getIncludes());
    }

    private async _findRaw(filter: Filter<Document>, options?: FindOptions): Promise<T[]> {
        const cursor = this.collection.find(filter, options ?? {});
        const array = await cursor.toArray();
        return this._mapDocuments(array);
    }

    /**
     * Aplica el filtro de Soft Delete si el modelo lo requiere.
     * En MongoDB `{ deletedAt: null }` matchea tanto documentos con campo `null` como sin el campo.
     */
    private _applySoftDeleteFilter(filter: Filter<Document>, withDeleted = false): Filter<Document> {
        if (isSoftDelete(this.modelType) && !withDeleted) {
            return { ...filter, deletedAt: null };
        }
        return filter;
    }

    private _mapDocuments(array: any[], includes: string[] = []): T[] {
        return array.map(doc => this._mapDocument(doc, includes));
    }

    /**
     * Mapea un documento de MongoDB a una instancia del modelo, respetando @Column y @NotMapped.
     * Para los campos de relación en `includes`, hidrata instancias del modelo relacionado.
     */
    private _mapDocument(doc: any, includes: string[] = []): T {
        const instance = new this.modelType();
        const columnMappings = getColumnMappings(this.modelType);
        const notMapped = getNotMappedFields(this.modelType);
        const foreignKeys = getForeignKeys(this.modelType);

        instance._id = doc._id;

        for (const key of Object.keys(instance)) {
            if (key.startsWith('_')) continue;
            if (notMapped.has(key)) continue;
            if (includes.includes(key)) continue;

            const mongoField = columnMappings[key] ?? key;
            if (Object.prototype.hasOwnProperty.call(doc, mongoField)) {
                (instance as any)[key] = doc[mongoField];
            }
        }

        for (const field of includes) {
            const fkMeta = foreignKeys[field];
            if (!fkMeta || !doc[field]) continue;

            const RelatedClass = fkMeta.model();
            const relatedInstance = new RelatedClass();
            const relatedDoc = doc[field];
            const relatedColumnMappings = getColumnMappings(RelatedClass);
            const relatedNotMapped = getNotMappedFields(RelatedClass);

            relatedInstance._id = relatedDoc._id;

            for (const key of Object.keys(relatedInstance)) {
                if (key.startsWith('_')) continue;
                if (relatedNotMapped.has(key)) continue;
                const mongoField = relatedColumnMappings[key] ?? key;
                if (Object.prototype.hasOwnProperty.call(relatedDoc, mongoField)) {
                    relatedInstance[key] = relatedDoc[mongoField];
                }
            }

            (instance as any)[field] = relatedInstance;
        }

        return instance;
    }
}
