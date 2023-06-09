import jsep, {ArrayExpression, BinaryExpression, Identifier, Literal, MemberExpression} from "jsep";
import jsepArrow, {ArrowExpression} from "@jsep-plugin/arrow";
import jsepObject, {ObjectExpression, Property} from "@jsep-plugin/object";
import jsepTemplateLiteral, {TemplateElement, TemplateLiteral} from "@jsep-plugin/template";
import {List, Stack} from "immutable";
import {
    SqlAlias, SqlBinary, SqlIdentifier, SqlMember, SqlNode, SqlParameter, SqlPrinter, SqlSelect, SqlStar, SqlString
} from "./sql";
import postgres from "postgres";
import {EntityModel} from "./model";

jsep.plugins.register(jsepTemplateLiteral);
jsep.plugins.register(jsepObject);
jsep.plugins.register(jsepArrow);

export function compileQuery<T extends object, A extends unknown[], R>(entity: EntityModel,
                                                                       builder?: (
                                                                           builder: QueryBuilder<T>,
                                                                           ...args: A
                                                                       ) => QueryBuilder<R>
) {

    let argsMap = List.of<string>();
    let node: QueryNode = new FromNode(entity);

    if (builder) {
        const arrowExpression = jsep(builder.toString()) as ArrowExpression;

        argsMap = List(arrowExpression.params!.slice(1)
                                              .map((e) => (e as Identifier).name));

        node = builder(new QueryBuilder(node), ...([] as unknown as A)).node;
    }

    const compiler = new QueryCompiler(argsMap);
    const sql = node.accept(compiler)
                    .accept(new SqlPrinter());

    console.log(sql);

    const db = postgres("postgres://postgres:postgres@localhost:5432/chinook", {
        // debug: (_, q, __) => console.log(q),
    });

    return async function* (...args: A) {
        // console.log(compiler.shaper.toString());

        const values = await db.unsafe(sql, args as any[])
                               .values();

        for await (const row of values) {
            yield compiler.shaper(row);
        }
    };
}

interface QueryVisitor<T> {
    visitFrom(from: FromNode): T;

    visitWhere(select: WhereNode): T;

    visitSelect(select: SelectNode): T;

    visitArrowFunction(arrowFunction: ArrowFunctionNode): T;

    visitArray(array: ArrayNode): T;

    visitBinary(binary: BinaryNode): T;

    visitLiteral(literal: LiteralNode): T;

    visitMember(member: MemberNode): T;

    visitObject(object: ObjectNode): T;

    visitObjectProperty(objectProperty: ObjectPropertyNode): T;

    visitTemplateLiteral(templateLiteral: TemplateLiteralNode): T;

    visitTemplateElement(templateElement: TemplateElementNode): T;

    visitIdentifier(identifier: IdentifierNode): T;
}

interface QueryNode {
    accept<T>(visitor: QueryVisitor<T>): T;
}

class FromNode implements QueryNode {
    constructor(readonly model: EntityModel) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitFrom(this);
    }
}

class WhereNode implements QueryNode {
    constructor(readonly parent: QueryNode, readonly predicate: QueryNode) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitWhere(this);
    }
}

class SelectNode implements QueryNode {
    constructor(readonly parent: QueryNode, readonly projection: QueryNode) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitSelect(this);
    }
}

class ArrowFunctionNode implements QueryNode {
    constructor(readonly params: List<QueryNode>, readonly body: QueryNode) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitArrowFunction(this);
    }
}

class ArrayNode implements QueryNode {
    constructor(readonly elements: List<QueryNode>) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitArray(this);
    }
}

type Operator = "==" | "!=" | ">" | ">=" | "<" | "<=" | "&&" | "||" | "*";

class BinaryNode implements QueryNode {
    constructor(readonly left: QueryNode, readonly op: Operator, readonly right: QueryNode) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitBinary(this);
    }
}

class ObjectNode implements QueryNode {
    constructor(readonly properties: List<ObjectPropertyNode>) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitObject(this);
    }
}

class ObjectPropertyNode implements QueryNode {
    constructor(readonly key: QueryNode, readonly value?: QueryNode) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitObjectProperty(this);
    }
}

class TemplateLiteralNode implements QueryNode {
    constructor(readonly quasis: List<TemplateElementNode>, readonly expressions: List<QueryNode>) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitTemplateLiteral(this);
    }
}

class TemplateElementNode implements QueryNode {
    constructor(readonly cooked: string, readonly raw: string) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitTemplateElement(this);
    }
}

class MemberNode implements QueryNode {
    constructor(readonly object: QueryNode, readonly member: QueryNode) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitMember(this);
    }
}

class IdentifierNode implements QueryNode {
    static is(node: QueryNode): node is IdentifierNode {
        return "name" in node;
    }

    constructor(readonly name: string) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitIdentifier(this);
    }
}

class LiteralNode implements QueryNode {
    constructor(readonly value: any) {
    }

    accept<T>(visitor: QueryVisitor<T>): T {
        return visitor.visitLiteral(this);
    }
}

export class QueryBuilder<T> {
    #node: QueryNode;

    constructor(node: QueryNode) {
        this.#node = node;
    }

    get node(): QueryNode {
        return this.#node;
    }

    where(predicate: (param: T) => boolean): QueryBuilder<T> {
        this.#node = new WhereNode(this.#node, QueryBuilder.parseExpr(predicate.toString()));

        return this;
    }

    filter(condition: (param: T) => boolean): QueryBuilder<T> {
        return this.where(condition);
    }

    select<S>(projector: (param: T) => S): QueryBuilder<S> {
        return new QueryBuilder(new SelectNode(this.node, QueryBuilder.parseExpr(projector.toString())));
    }

    map<S>(mapper: (param: T) => S): QueryBuilder<S> {
        return this.select(mapper);
    }

    private static parseExpr(js: string): QueryNode {
        const expr = jsep(js);

        //console.log(expr);

        return this.exprToNode(expr);
    }

    private static exprToNode(expr: jsep.Expression): QueryNode {
        switch (expr.type) {
            case "ArrayExpression":
                const array = expr as ArrayExpression;
                return new ArrayNode(List(array.elements?.map((e) => this.exprToNode(e))));

            case "ArrowFunctionExpression":
                const arrow = expr as ArrowExpression;
                return new ArrowFunctionNode(List(arrow.params?.map((e) => this.exprToNode(e))),
                                             this.exprToNode(arrow.body));

            case "BinaryExpression":
                const binary = expr as BinaryExpression;
                return new BinaryNode(this.exprToNode(binary.left),
                                      this.parseOp(binary.operator),
                                      this.exprToNode(binary.right));

            case "Literal":
                const literal = expr as Literal;
                return new LiteralNode(literal.value);

            case "Identifier":
                const identifier = expr as Identifier;
                return new IdentifierNode(identifier.name);

            case "MemberExpression":
                const member = expr as MemberExpression;
                return new MemberNode(this.exprToNode(member.object), this.exprToNode(member.property));

            case "ObjectExpression":
                const object = expr as ObjectExpression;
                return new ObjectNode(List(object.properties.map((e) => this.exprToNode(e) as ObjectPropertyNode)));

            case "Property":
                const property = expr as Property;
                return new ObjectPropertyNode(this.exprToNode(property.key),
                                              property.value ? this.exprToNode(property.value) : undefined);

            case "TemplateLiteral":
                const templateLiteral = expr as TemplateLiteral;
                return new TemplateLiteralNode(List(templateLiteral.quasis?.map((e) => this.exprToNode(e) as TemplateElementNode)),
                                               List(templateLiteral.expressions?.map((e) => this.exprToNode(e))));

            case "TemplateElement":
                const templateElement = expr as TemplateElement;
                return new TemplateElementNode(templateElement.value.cooked, templateElement.value.raw);

            default:
                throw new Error(`Unsupported expression type: ${expr.type}`);
        }
    }

    private static parseOp(op: string): Operator {
        switch (op) {
            case "===":
                return "==";
            case "!==":
                return "!=";

            case "==":
            case "!=":
            case ">":
            case ">=":
            case "<":
            case "<=":
            case "&&":
            case "||":
            case "*":
                return op;

            default:
                throw new Error(`Unknown operator: ${op}`);
        }
    }
}

class QueryCompiler implements QueryVisitor<SqlNode> {
    #scopes: Stack<IdentifierNode> = Stack();
    #aliases: Stack<SqlIdentifier> = Stack();

    #model?: EntityModel;

    #depth = 0;
    #shaper: ((row: any[]) => any) | undefined;

    constructor(readonly argsMap: List<string>) {
    }

    public get shaper(): (row: any[]) => any {
        return this.#shaper!;
    }

    visitFrom(from: FromNode): SqlNode {
        this.#model = from.model;
        const table = from.model.table;
        const alias = new SqlIdentifier(table.charAt(0)
                                             .toLowerCase());
        const columns = from.model.properties.map((p) => p.column)
                            .toList();

        this.#shaper = (row: any[]) => {
            const o = new from.model.ctor();
            columns.map((k, i) => (o[k] = row[i]));
            return o;
        };

        return new SqlSelect(List(columns.map((c) => new SqlMember(alias, new SqlIdentifier(c)))),
                             new SqlAlias(new SqlIdentifier(table), alias));
    }

    visitWhere(where: WhereNode): SqlNode {
        const alias = new SqlIdentifier(`t${this.#depth++}`);

        this.#aliases = this.#aliases.push(alias);

        try {
            return new SqlSelect(List.of(new SqlMember(alias, SqlStar.instance)),
                                 new SqlAlias(where.parent.accept(this), alias),
                                 where.predicate.accept(this));
        }
        finally {
            this.#aliases = this.#aliases.pop();
        }
    }

    visitSelect(select: SelectNode): SqlNode {
        const alias = new SqlIdentifier(`t${this.#depth++}`);

        this.#aliases = this.#aliases.push(alias);

        try {
            const from = new SqlAlias(select.parent.accept(this), alias);

            let projection: List<SqlNode>;
            let node = select.projection.accept(this);

            if (ShaperNode.is(node)) {
                projection = node.projection;
                this.#shaper = node.shaper;
            } else {
                projection = List.of(node);
                this.#shaper = (row: any[]) => {
                    return row[0];
                };
            }

            return new SqlSelect(projection, from);
        }
        finally {
            this.#aliases = this.#aliases.pop();
        }
    }

    visitArrowFunction(arrowFunction: ArrowFunctionNode): SqlNode {
        const param = arrowFunction.params.first() as IdentifierNode;

        this.#scopes = this.#scopes.push(param);

        try {
            return arrowFunction.body.accept(this);
        }
        finally {
            this.#scopes = this.#scopes.pop();
        }
    }

    visitBinary(binary: BinaryNode): SqlNode {
        const left = binary.left.accept(this);
        let right = binary.right.accept(this);

        return new SqlBinary(left, QueryCompiler.mapOp(binary.op), right);
    }

    private static mapOp(op: Operator) {
        switch (op) {
            case "==":
                return "=";
            case "!=":
                return "<>";

            case "&&":
                return "and";
            case "||":
                return "or";

            case ">":
            case ">=":
            case "<":
            case "<=":
            case "*":
                return op;

            default:
                throw new Error(`Unknown operator: ${op}`);
        }
    }

    visitMember(member: MemberNode): SqlNode {
        const identifier = member.member as IdentifierNode;
        const model = this.#model!.properties.get(identifier.name)!;
        const node = new SqlIdentifier(model!.column);

        return !this.#aliases.isEmpty() ? new SqlMember(this.#aliases.peek()!, node) : node;
    }

    visitArray(array: ArrayNode): SqlNode {
        throw new Error("Method not implemented.");
    }

    visitObject(object: ObjectNode): SqlNode {
        const projection = object.properties.map((p) => p.accept(this));
        const keys = object.properties.map((p) => (p.key as IdentifierNode).name);

        const shaper = (row: any[]) => {
            const o = {} as any;
            keys.map((k, i) => (o[k] = row[i]));
            return o;
        };

        return new ShaperNode(projection, shaper);
    }

    visitObjectProperty(objectProperty: ObjectPropertyNode): SqlNode {
        return objectProperty.value?.accept(this)!;
    }

    visitTemplateLiteral(templateLiteral: TemplateLiteralNode): SqlNode {
        return templateLiteral.quasis
                              .map((q, i) => {
                                  const quasi = q.raw.length > 0 ? q.accept(this) : undefined;
                                  const expr = templateLiteral.expressions.get(i)
                                                              ?.accept(this);
                                  return quasi && expr ? new SqlBinary(quasi, "||", expr) : (quasi ?? expr)!;
                              })
                              .reduce((acc: SqlNode, next) => acc ? new SqlBinary(acc, "||", next!) : next);
    }

    visitTemplateElement(templateElement: TemplateElementNode): SqlNode {
        return new SqlString(templateElement.raw);
    }

    visitIdentifier(identifier: IdentifierNode): SqlNode {
        const index = this.argsMap.keyOf(identifier.name);

        if (index != undefined) {
            return new SqlParameter(index + 1);
        }

        throw new Error(`Unbound identifier '${identifier.name}'`);
    }

    visitLiteral(literal: LiteralNode): SqlNode {
        return new SqlString(literal.value);
    }
}

class ShaperNode extends SqlNode {
    static is(node: SqlNode): node is ShaperNode {
        return "projection" in node;
    }

    constructor(readonly projection: List<SqlNode>, readonly shaper: (row: any[]) => any) {
        super();
    }
}
