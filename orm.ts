import {Model, ModelBuilder} from "./model";
import {compileQuery, QueryBuilder} from "./query";

export function orm(builder: (ob: OrmBuilder) => void) {
    const ob = new OrmBuilder();
    builder(ob);
    return ob.build();
}

class OrmBuilder {
    #model: Model = new Model();

    build() {
        return new Orm(this.#model);
    }

    model(builder: (mb: ModelBuilder) => void) {
        const mb = new ModelBuilder(this.#model);
        builder(mb);
        this.#model = mb.model;

        return this;
    }
}

class Orm {
    constructor(readonly model: Model) {
    }

    query<T extends object, A extends unknown[], R>(
        entity: new (...args: any[]) => T,
        builder?: (
            builder: QueryBuilder<T>,
            ...args: A) => QueryBuilder<R>) {

        const entityType = this.model.entities.get(entity);

        if (!entityType) {
            throw new Error(`Entity '${entity.name}' not found in model.`);
        }

        return compileQuery(entityType, builder);
    }
}
