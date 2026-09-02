import { Db, MongoClient } from 'mongodb';
import { MongoEFCollection } from './MongoEFCollection';
import { getIndexes } from './decorators/metadata';

export { _collectionNameRegistry } from './decorators/metadata';

export class DbContext {
    private _connection: Db | undefined;
    private _client: MongoClient | undefined;

    /**
     * Crea una nueva instancia de DbContext.
     * @param url URL de conexión a MongoDB.
     * @param dbName Nombre de la base de datos.
     * @param autoConnect @deprecated Pasar `false` y llamar `await context.connect()` manualmente.
     */
    constructor(private url: string, private dbName: string, autoConnect = false) {
        if (autoConnect) {
            console.warn('[mongoef] autoConnect está deprecado. Usá await context.connect() manualmente.');
            this.connect();
        }
    }

    /**
     * Establece la conexión con MongoDB e inicializa las colecciones declaradas en el contexto.
     * También crea automáticamente los índices definidos con @Index en cada modelo.
     */
    public async connect(): Promise<void> {
        this._client = await MongoClient.connect(this.url);
        this._connection = this._client.db(this.dbName);

        for (const key of Object.keys(this)) {
            const value = (this as any)[key];
            if (!(value instanceof MongoEFCollection)) continue;

            const mongoCollection = this.connection.collection(value.getCollectionName());
            value.collection = mongoCollection;

            const indexes = getIndexes(value.getModelType());
            for (const idx of indexes) {
                await mongoCollection.createIndex(idx.key, idx.options ?? {});
            }
        }
    }

    /**
     * Cierra la conexión con MongoDB y libera los recursos.
     */
    public async disconnect(): Promise<void> {
        if (this._client) {
            await this._client.close();
            this._client = undefined;
            this._connection = undefined;
        }
    }

    /**
     * Retorna la instancia de la base de datos activa.
     * @throws Error si `connect()` no fue llamado antes.
     */
    public get connection(): Db {
        if (this._connection) {
            return this._connection;
        }
        throw new Error('[mongoef] No hay conexión activa. Llamá await context.connect() primero.');
    }
}