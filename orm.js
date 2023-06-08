"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orm = void 0;
const model_1 = require("./model");
const query_1 = require("./query");
function orm(builder) {
    const ob = new OrmBuilder();
    builder(ob);
    return ob.build();
}
exports.orm = orm;
class OrmBuilder {
    #model = new model_1.Model();
    build() {
        return new Orm(this.#model);
    }
    model(builder) {
        const mb = new model_1.ModelBuilder(this.#model);
        builder(mb);
        this.#model = mb.model;
        return this;
    }
}
class Orm {
    model;
    constructor(model) {
        this.model = model;
    }
    query(entity, builder) {
        const entityType = this.model.entities.get(entity);
        if (!entityType) {
            throw new Error(`Entity '${entity.name}' not found in model.`);
        }
        return (0, query_1.compileQuery)(entityType, builder);
    }
}
