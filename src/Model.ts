import { ObjectId, UpdateOptions } from "mongodb";
import { DbContext, _collectionNameRegistry } from "./DbContext";



export abstract class Model {
    _id: ObjectId | undefined;

    constructor() {
    }

    public async save(context: DbContext) {
        const collection = context.connection.collection(this.getCollectionName());

        const dataToSave: any = {};

        for (const key of Object.keys(this)) {
            if (!key.startsWith('_')) {
                dataToSave[key] = (this as any)[key];
            }
        }

        if (this._id) {
            await collection.updateOne(
                { _id: this._id }, 
                { $set: dataToSave } 
            );
        } else {
            const result = await collection.insertOne(dataToSave);
            this._id = result.insertedId; 
        }
    }

    protected getCollectionName(): string {
        const className = this.constructor.name;
        return _collectionNameRegistry[className] || className.toLowerCase(); 
    }

    public async delete(context: DbContext){
        const collection = context.connection.collection(this.getCollectionName());
        const r = await collection.deleteOne({_id:this._id}); 
        return r.deletedCount;
    }
}



