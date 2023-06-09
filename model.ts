import { Map } from "immutable";

export class Model {
  constructor(
    readonly entities: Map<new (...args: any[]) => any, EntityModel> = Map()
  ) {}

  withEntity(key: new (...args: any[]) => any, model: EntityModel) {
    const entities = this.entities.set(key, model);

    if (entities === this.entities) {
      return this;
    }

    return new Model(entities);
  }
}

export class ModelBuilder {
  #model: Model;

  constructor(model: Model) {
    this.#model = model;
  }

  public get model(): Model {
    return this.#model;
  }

  entity<T extends object>(
    ctor: new (...args: any[]) => T,
    builder: (eb: EntityBuilder<T>) => void
  ): ModelBuilder {
    let model = this.#model.entities.get(ctor);

    if (!model) {
      model = new EntityModel(ctor);
    }

    const eb = new EntityBuilder<T>(model);

    builder(eb);

    this.#model = this.#model.withEntity(ctor, eb.model);

    return this;
  }
}

export class EntityModel {
  constructor(
    readonly ctor: new (...args: any[]) => any,
    readonly properties: Map<string, PropertyModel> = Map(),
    readonly table: string = ctor.name
  ) {
    if (properties.isEmpty()) {
      const keys = Object.keys(new ctor());
      this.properties = Map(keys.map((k) => [k, new PropertyModel(k)]));
    }
  }

  withProperty(key: string, model: PropertyModel): EntityModel {
    const properties = this.properties.set(key, model);

    if (properties === this.properties) {
      return this;
    }

    return new EntityModel(this.ctor, properties, this.table);
  }

  withTable(table: string): EntityModel {
    if (table === this.table) {
      return this;
    }

    return new EntityModel(this.ctor, this.properties, table);
  }
}

export class EntityBuilder<T> {
  #model: EntityModel;

  constructor(model: EntityModel) {
    this.#model = model;
  }

  public get model(): EntityModel {
    return this.#model;
  }

  properties<
    S,
    TProps extends {
      [Key in keyof TProps & keyof T & string]:
        | (<U>(pb: PropertyBuilder<U>) => PropertyBuilder<U>)
        | ({
            column?: string;
          } & (T[Key] extends number ? { scale?: number } : {}));
    }
  >(props: TProps): EntityBuilder<T> {
    (Object.keys(props) as (keyof T & keyof TProps & string)[]).forEach(
      (prop) => {
        const model = this.#model.properties.get(prop);
        if (!model) {
          throw new Error(`Property '${prop}' not found in model.`);
        }
        const pb = new PropertyBuilder(model);
        const config = props[prop as keyof TProps];

        if (typeof config === "function") {
          config(pb);
        } else {
          if (config.column) {
            pb.column(config.column);
          }
        }

        this.#model = this.#model.withProperty(prop, pb.model);
      }
    );

    return this;
  }

  property<S>(
    key: keyof T,
    builder: (pb: PropertyBuilder<S>) => void
  ): EntityBuilder<T> {
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

  table(name: string): EntityBuilder<T> {
    this.#model = this.#model.withTable(name);

    return this;
  }
}

export class PropertyModel {
  constructor(readonly name: string, readonly column: string = name) {}

  withColumn(column: string): PropertyModel {
    if (column === this.column) {
      return this;
    }

    return new PropertyModel(column);
  }
}

export class PropertyBuilder<T> {
  #model: PropertyModel;

  constructor(model: PropertyModel) {
    this.#model = model;
  }

  public get model(): PropertyModel {
    return this.#model;
  }

  column(name: string): PropertyBuilder<T> {
    this.#model = this.#model.withColumn(name);

    return this;
  }
}
