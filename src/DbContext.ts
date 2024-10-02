import { Db, MongoClient } from "mongodb";
import { MongoEFCollection } from "./MongoEFCollection";

export const _collectionNameRegistry: { [key: string]: string } = {};


export class DbContext {
    private _connection: Db | undefined;

    constructor(private url: string, private dbName: string, autoConnect = true) {
        if (autoConnect) {
            this.connect();
        }
    }

    public async connect() {
        const client = await MongoClient.connect(this.url);
        this._connection = client.db(this.dbName);

        for (const key of Object.keys(this)) {
            const value = this[key as keyof typeof this] as any;
            if (value instanceof MongoEFCollection) {
                console.log("Creando coleccion:",value.getCollectionName());
                value.collection = this.connection.collection(value.getCollectionName());
            }
        }
    }

    public get connection() {
        if (this._connection) {
            return this._connection;
        }
        throw 'Not connected';
    }
}