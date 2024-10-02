import { Collection, Filter, FindOptions, ObjectId } from "mongodb";
import { _collectionNameRegistry } from "./DbContext";
import { Model } from "./Model";

export class MongoEFCollection<T extends Model> {
    collection!: Collection;

    constructor(private modelType: { new (): T }) { }

    getCollectionName(): string {
        const className = this.modelType.name;
        return _collectionNameRegistry[className] || className.toLowerCase(); 
    }

    public async filter(filter:Filter<any>,options?: FindOptions){
        return this.selectInternal(filter,options);
    }

    public async all(){
        return this.selectInternal();
    }


    public async delete(obj: T | T[] | ObjectId) {
        if (obj instanceof ObjectId) {
            const result = await this.collection.deleteOne({ _id: obj });
            return result.deletedCount; 
        } else if (obj instanceof this.modelType) {
            const result = await this.collection.deleteOne({ _id: obj._id });
            return result.deletedCount; 
        } else if (Array.isArray(obj)) {
            const deletePromises = obj.map(async (item) => {
                const id = item instanceof ObjectId ? item : item._id; 
                return this.collection.deleteOne({ _id: id });
            });
            const results = await Promise.all(deletePromises);
            return results.reduce((total, result) => total + result.deletedCount, 0); 
        }
        throw new Error('Invalid argument type.'); 
    }

    private async selectInternal(filter?: Filter<any>, options?: FindOptions) {
        let cursor;

        if (filter) {
            cursor = await this.collection.find(filter, options);
        } else {
            cursor = await this.collection.find();
        }

        const array = await cursor.toArray();

        const mappedArray: T[] = [];

        for (const i of array) {
            const newObj = new this.modelType();
            newObj._id = i._id;

            for (const key of Object.keys(newObj)) {
                if (!key.startsWith('_') && i.hasOwnProperty(key)) {
                    (newObj as any)[key] = i[key];
                }
            }
            mappedArray.push(newObj);
        }

        return mappedArray;
    }
}

