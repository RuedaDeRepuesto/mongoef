import { Document, Filter, Sort } from 'mongodb';

export interface QueryExecutor<T> {
    execute(builder: QueryBuilder<T>): Promise<T[]>;
    count(builder: QueryBuilder<T>): Promise<number>;
}

export class QueryBuilder<T> {
    private _filter: Filter<Document> = {};
    private _sort: Sort | undefined;
    private _skipValue: number | undefined;
    private _limitValue: number | undefined;
    private _includes: string[] = [];
    private _withDeleted: boolean = false;

    constructor(private readonly executor: QueryExecutor<T>) {}

    /**
     * Aplica un filtro a la consulta.
     * Si ya existe un filtro previo, los combina con `$and`.
     * @param filter Filtro de MongoDB.
     */
    public where(filter: Filter<Document>): this {
        if (Object.keys(this._filter).length === 0) {
            this._filter = filter;
        } else if (this._filter.$and) {
            (this._filter.$and as any[]).push(filter);
        } else {
            this._filter = { $and: [this._filter, filter] } as Filter<Document>;
        }
        return this;
    }

    /**
     * Ordena los resultados por un campo.
     * @param field Campo por el cual ordenar.
     * @param direction Dirección del orden: 'asc' o 'desc'. Por defecto 'asc'.
     */
    public orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
        this._sort = { [field]: direction === 'asc' ? 1 : -1 };
        return this;
    }

    /**
     * Omite los primeros N resultados para paginación.
     * @param n Cantidad de documentos a omitir.
     */
    public skip(n: number): this {
        this._skipValue = n;
        return this;
    }

    /**
     * Limita la cantidad de resultados retornados.
     * @param n Cantidad máxima de resultados.
     */
    public take(n: number): this {
        this._limitValue = n;
        return this;
    }

    /**
     * Hidrata una propiedad de relación definida con @ForeignKey usando $lookup en el pipeline.
     * Puede encadenarse múltiples veces para incluir varias relaciones.
     * @param field Nombre de la propiedad de relación en el modelo.
     */
    public include(field: string): this {
        this._includes.push(field);
        return this;
    }

    /**
     * Incluye documentos eliminados (cuando el modelo usa @SoftDelete) en los resultados.
     */
    public withDeleted(): this {
        this._withDeleted = true;
        return this;
    }

    /**
     * Ejecuta la consulta y retorna todos los resultados como array.
     */
    public toList(): Promise<T[]> {
        return this.executor.execute(this);
    }

    /**
     * Ejecuta la consulta y retorna el primer resultado, o null si no hay resultados.
     */
    public async first(): Promise<T | null> {
        const original = this._limitValue;
        this._limitValue = 1;
        const results = await this.executor.execute(this);
        this._limitValue = original;
        return results[0] ?? null;
    }

    /**
     * Retorna la cantidad de documentos que cumplen con el filtro actual.
     */
    public count(): Promise<number> {
        return this.executor.count(this);
    }

    public getFilter(): Filter<Document> { return this._filter; }
    public getSort(): Sort | undefined { return this._sort; }
    public getSkip(): number | undefined { return this._skipValue; }
    public getLimit(): number | undefined { return this._limitValue; }
    public getIncludes(): string[] { return this._includes; }
    public isWithDeleted(): boolean { return this._withDeleted; }
}
