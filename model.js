"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyModel = exports.EntityModel = exports.ModelBuilder = exports.Model = void 0;
const immutable_1 = require("immutable");
class Model {
    entities;
    constructor(entities = (0, immutable_1.Map)()) {
        this.entities = entities;
    }
    withEntity(key, model) {
        const entities = this.entities.set(key, model);
        if (entities === this.entities)
            return this;
        return new Model(entities);
    }
}
exports.Model = Model;
class ModelBuilder {
    #model;
    constructor(model) {
        this.#model = model;
    }
    get model() {
        return this.#model;
    }
    entity(ctor, builder) {
        let model = this.#model.entities.get(ctor);
        if (!model) {
            model = new EntityModel(ctor);
        }
        const eb = new EntityBuilder(model);
        builder(eb);
        this.#model = this.#model.withEntity(ctor, eb.model);
        return this;
    }
}
exports.ModelBuilder = ModelBuilder;
class EntityModel {
    ctor;
    properties;
    table;
    constructor(ctor, properties = (0, immutable_1.Map)(), table = ctor.name) {
        this.ctor = ctor;
        this.properties = properties;
        this.table = table;
        if (properties.isEmpty()) {
            const keys = Object.keys(new ctor());
            this.properties = (0, immutable_1.Map)(keys.map(k => [k, new PropertyModel(k)]));
        }
    }
    withProperty(key, model) {
        const properties = this.properties.set(key, model);
        if (properties === this.properties)
            return this;
        return new EntityModel(this.ctor, properties, this.table);
    }
    withTable(table) {
        if (table === this.table)
            return this;
        return new EntityModel(this.ctor, this.properties, table);
    }
}
exports.EntityModel = EntityModel;
class EntityBuilder {
    #model;
    constructor(model) {
        this.#model = model;
    }
    get model() {
        return this.#model;
    }
    property(key, builder) {
        if (typeof key !== "string") {
            throw Error(`Property '${key.toString()}' must be a string.`);
        }
        const model = this.#model.properties.get(key);
        if (!model) {
            throw new Error(`Property '${key}' not found in model.`);
        }
        const pb = new PropertyBuilder(model);
        builder(pb);
        this.#model = this.#model.withProperty(key, pb.model);
        return this;
    }
    table(name) {
        this.#model = this.#model.withTable(name);
        return this;
    }
}
class PropertyModel {
    name;
    column;
    constructor(name, column = name) {
        this.name = name;
        this.column = column;
    }
    withColumn(column) {
        if (column === this.column)
            return this;
        return new PropertyModel(column);
    }
}
exports.PropertyModel = PropertyModel;
class PropertyBuilder {
    #model;
    constructor(model) {
        this.#model = model;
    }
    get model() {
        return this.#model;
    }
    column(name) {
        this.#model = this.#model.withColumn(name);
        return this;
    }
}
