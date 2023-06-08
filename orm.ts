import { Model, ModelBuilder } from "./model";
import { QueryBuilder, compileQuery } from "./query";

export function orm(builder: (ob: OrmBuilder) => void): Orm {
    const ob = new OrmBuilder();
    builder(ob);
    return ob.build();
}

class OrmBuilder {
    #model: Model = new Model();

    build() {
        return new Orm(this.#model);
    }

    model(builder: (mb: ModelBuilder) => void): OrmBuilder {
        const mb = new ModelBuilder(this.#model);
        builder(mb);
        this.#model = mb.model;
        return this;
    }
}

class Orm {
    constructor(readonly model: Model) {}

    query<
        T extends object,
        Args extends Args[number][],
        R
    >(
        entity: new (...args: any[]) => T,
        builder?: (...args: [QueryBuilder<T>, ...Args]) => QueryBuilder<R>
    ) {
        const entityType = this.model.entities.get(entity);
        
        if (!entityType) {
            throw new Error(`Entity '${entity.name}' not found in model.`);
        }

        return compileQuery(entityType, builder);
    }

    // query<T extends object>(
    //     entity: new (...args: any[]) => T
    // ): () => AsyncIterable<T>;

    // query<T extends object, A0, R>(
    //     entity: new (...args: any[]) => T,
    //     builder: (q: QueryBuilder<T>, arg0: A0) => QueryBuilder<R>
    // ): (arg0: A0) => AsyncIterable<R>;

    // query<T extends object, A0, A1>(
    //     entity: new (...args: any[]) => T,
    //     builder: (q: QueryBuilder<T>, arg0: A0, arg1: A1) => QueryBuilder<T>
    // ): (arg0: A0, arg1: A1) => AsyncIterable<T>;

    // query<T extends object, A0, A1, R>(
    //     entity: new (...args: any[]) => T,
    //     builder?: (q: QueryBuilder<T>, arg0: A0, arg1: A1) => QueryBuilder<R>
    // ): (arg0: A0, arg1: A1) => AsyncIterable<R> {
    //     const entityType = this.model.entities.get(entity);

    //     if (!entityType) {
    //         throw new Error(`Entity '${entity.name}' not found in model.`);
    //     }

    //     return compileQuery(entityType, builder);
    // }
}
