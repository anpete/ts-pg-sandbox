"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryBuilder = exports.compileQuery = void 0;
const jsep_1 = __importDefault(require("jsep"));
const arrow_1 = __importDefault(require("@jsep-plugin/arrow"));
const object_1 = __importDefault(require("@jsep-plugin/object"));
const template_1 = __importDefault(require("@jsep-plugin/template"));
const immutable_1 = require("immutable");
const sql_1 = require("./sql");
const postgres_1 = __importDefault(require("postgres"));
jsep_1.default.plugins.register(template_1.default);
jsep_1.default.plugins.register(object_1.default);
jsep_1.default.plugins.register(arrow_1.default);
function compileQuery(entity, builder) {
    let argsMap = immutable_1.List.of();
    let node = new FromNode(entity);
    if (builder) {
        const arrowExpression = (0, jsep_1.default)(builder.toString());
        argsMap = (0, immutable_1.List)(arrowExpression.params.slice(1).map((e) => e.name));
        node = builder(new QueryBuilder(node), ...[]).node;
    }
    const compiler = new QueryCompiler(argsMap);
    const sql = node.accept(compiler).accept(new sql_1.SqlPrinter());
    console.log(sql);
    const db = (0, postgres_1.default)("postgres://postgres:postgres@db:5432/tests", {
    // debug: (_, q, __) => console.log(q),
    });
    return async function* (...args) {
        // console.log(compiler.shaper.toString());
        const values = await db.unsafe(sql, args).values();
        for await (const row of values) {
            yield compiler.shaper(row);
        }
    };
}
exports.compileQuery = compileQuery;
class FromNode {
    model;
    constructor(model) {
        this.model = model;
    }
    accept(visitor) {
        return visitor.visitFrom(this);
    }
}
class WhereNode {
    parent;
    predicate;
    constructor(parent, predicate) {
        this.parent = parent;
        this.predicate = predicate;
    }
    accept(visitor) {
        return visitor.visitWhere(this);
    }
}
class SelectNode {
    parent;
    projection;
    constructor(parent, projection) {
        this.parent = parent;
        this.projection = projection;
    }
    accept(visitor) {
        return visitor.visitSelect(this);
    }
}
class ArrowFunctionNode {
    params;
    body;
    constructor(params, body) {
        this.params = params;
        this.body = body;
    }
    accept(visitor) {
        return visitor.visitArrowFunction(this);
    }
}
class ArrayNode {
    elements;
    constructor(elements) {
        this.elements = elements;
    }
    accept(visitor) {
        return visitor.visitArray(this);
    }
}
var Operator;
(function (Operator) {
    Operator[Operator["=="] = 0] = "==";
    Operator[Operator["!="] = 1] = "!=";
    Operator[Operator[">"] = 2] = ">";
    Operator[Operator[">="] = 3] = ">=";
    Operator[Operator["<"] = 4] = "<";
    Operator[Operator["<="] = 5] = "<=";
    Operator[Operator["&&"] = 6] = "&&";
    Operator[Operator["||"] = 7] = "||";
    Operator[Operator["*"] = 8] = "*";
})(Operator || (Operator = {}));
class BinaryNode {
    left;
    op;
    right;
    constructor(left, op, right) {
        this.left = left;
        this.op = op;
        this.right = right;
    }
    accept(visitor) {
        return visitor.visitBinary(this);
    }
}
class ObjectNode {
    properties;
    constructor(properties) {
        this.properties = properties;
    }
    accept(visitor) {
        return visitor.visitObject(this);
    }
}
class ObjectPropertyNode {
    key;
    value;
    constructor(key, value) {
        this.key = key;
        this.value = value;
    }
    accept(visitor) {
        return visitor.visitObjectProperty(this);
    }
}
class TemplateLiteralNode {
    quasis;
    expressions;
    constructor(quasis, expressions) {
        this.quasis = quasis;
        this.expressions = expressions;
    }
    accept(visitor) {
        return visitor.visitTemplateLiteral(this);
    }
}
class TemplateElementNode {
    cooked;
    raw;
    constructor(cooked, raw) {
        this.cooked = cooked;
        this.raw = raw;
    }
    accept(visitor) {
        return visitor.visitTemplateElement(this);
    }
}
class MemberNode {
    object;
    member;
    constructor(object, member) {
        this.object = object;
        this.member = member;
    }
    accept(visitor) {
        return visitor.visitMember(this);
    }
}
class IdentifierNode {
    name;
    static is(node) {
        return "name" in node;
    }
    constructor(name) {
        this.name = name;
    }
    accept(visitor) {
        return visitor.visitIdentifier(this);
    }
}
class LiteralNode {
    value;
    constructor(value) {
        this.value = value;
    }
    accept(visitor) {
        return visitor.visitLiteral(this);
    }
}
class QueryBuilder {
    #node;
    constructor(node) {
        this.#node = node;
    }
    get node() {
        return this.#node;
    }
    where(predicate) {
        this.#node = new WhereNode(this.#node, QueryBuilder.parseExpr(predicate.toString()));
        return this;
    }
    filter(condition) {
        return this.where(condition);
    }
    select(projector) {
        return new QueryBuilder(new SelectNode(this.node, QueryBuilder.parseExpr(projector.toString())));
    }
    map(mapper) {
        return this.select(mapper);
    }
    static parseExpr(js) {
        var expr = (0, jsep_1.default)(js);
        //console.log(expr);
        return this.exprToNode(expr);
    }
    static exprToNode(expr) {
        switch (expr.type) {
            case "ArrayExpression":
                const array = expr;
                return new ArrayNode((0, immutable_1.List)(array.elements?.map((e) => this.exprToNode(e))));
            case "ArrowFunctionExpression":
                const arrow = expr;
                return new ArrowFunctionNode((0, immutable_1.List)(arrow.params?.map((e) => this.exprToNode(e))), this.exprToNode(arrow.body));
            case "BinaryExpression":
                const binary = expr;
                return new BinaryNode(this.exprToNode(binary.left), this.parseOp(binary.operator), this.exprToNode(binary.right));
            case "Literal":
                const literal = expr;
                return new LiteralNode(literal.value);
            case "Identifier":
                const identifier = expr;
                return new IdentifierNode(identifier.name);
            case "MemberExpression":
                const member = expr;
                return new MemberNode(this.exprToNode(member.object), this.exprToNode(member.property));
            case "ObjectExpression":
                const object = expr;
                return new ObjectNode((0, immutable_1.List)(object.properties.map((e) => this.exprToNode(e))));
            case "Property":
                const property = expr;
                return new ObjectPropertyNode(this.exprToNode(property.key), property.value ? this.exprToNode(property.value) : undefined);
            case "TemplateLiteral":
                const templateLiteral = expr;
                return new TemplateLiteralNode((0, immutable_1.List)(templateLiteral.quasis?.map((e) => this.exprToNode(e))), (0, immutable_1.List)(templateLiteral.expressions?.map((e) => this.exprToNode(e))));
            case "TemplateElement":
                const templateElement = expr;
                return new TemplateElementNode(templateElement.value.cooked, templateElement.value.raw);
            default:
                throw new Error(`Unsupported expression type: ${expr.type}`);
        }
    }
    static parseOp(op) {
        switch (op) {
            case "==":
            case "===":
                return Operator["=="];
            case "!=":
                return Operator["!="];
            case ">":
                return Operator[">"];
            case ">=":
                return Operator[">="];
            case "<":
                return Operator["<"];
            case "<=":
                return Operator["<="];
            case "&&":
                return Operator["&&"];
            case "||":
                return Operator["||"];
            case "*":
                return Operator["*"];
            default:
                throw new Error(`Unknown operator: ${op}`);
        }
    }
}
exports.QueryBuilder = QueryBuilder;
class QueryCompiler {
    argsMap;
    #scopes = (0, immutable_1.Stack)();
    #aliases = (0, immutable_1.Stack)();
    #model;
    #depth = 0;
    #shaper;
    constructor(argsMap) {
        this.argsMap = argsMap;
    }
    get shaper() {
        return this.#shaper;
    }
    visitFrom(from) {
        this.#model = from.model;
        const table = from.model.table;
        const alias = new sql_1.SqlIdentifier(table.charAt(0).toLowerCase());
        const columns = from.model.properties.map((p) => p.column).toList();
        this.#shaper = (row) => {
            const o = new from.model.ctor();
            columns.map((k, i) => (o[k] = row[i]));
            return o;
        };
        return new sql_1.SqlSelect((0, immutable_1.List)(columns.map((c) => new sql_1.SqlMember(alias, new sql_1.SqlIdentifier(c)))), new sql_1.SqlAlias(new sql_1.SqlIdentifier(table), alias));
    }
    visitWhere(where) {
        const alias = new sql_1.SqlIdentifier(`t${this.#depth++}`);
        this.#aliases = this.#aliases.push(alias);
        try {
            return new sql_1.SqlSelect(immutable_1.List.of(new sql_1.SqlMember(alias, sql_1.SqlStar.instance)), new sql_1.SqlAlias(where.parent.accept(this), alias), where.predicate.accept(this));
        }
        finally {
            this.#aliases = this.#aliases.pop();
        }
    }
    visitSelect(select) {
        const alias = new sql_1.SqlIdentifier(`t${this.#depth++}`);
        this.#aliases = this.#aliases.push(alias);
        try {
            const from = new sql_1.SqlAlias(select.parent.accept(this), alias);
            let projection;
            let node = select.projection.accept(this);
            if (ShaperNode.is(node)) {
                projection = node.projection;
                this.#shaper = node.shaper;
            }
            else {
                projection = immutable_1.List.of(node);
                this.#shaper = (row) => {
                    return row[0];
                };
            }
            const sql = new sql_1.SqlSelect(projection, from);
            return sql;
        }
        finally {
            this.#aliases = this.#aliases.pop();
        }
    }
    visitArrowFunction(arrowFunction) {
        const param = arrowFunction.params.first();
        this.#scopes = this.#scopes.push(param);
        try {
            return arrowFunction.body.accept(this);
        }
        finally {
            this.#scopes = this.#scopes.pop();
        }
    }
    visitBinary(binary) {
        const left = binary.left.accept(this);
        let right = binary.right.accept(this);
        return new sql_1.SqlBinary(left, QueryCompiler.mapOp(binary.op), right);
    }
    static mapOp(op) {
        switch (op) {
            case Operator["=="]:
                return sql_1.SqlOperator["="];
            case Operator["!="]:
                return sql_1.SqlOperator["<>"];
            case Operator[">"]:
                return sql_1.SqlOperator[">"];
            case Operator[">="]:
                return sql_1.SqlOperator[">="];
            case Operator["<"]:
                return sql_1.SqlOperator["<"];
            case Operator["<="]:
                return sql_1.SqlOperator["<="];
            case Operator["&&"]:
                return sql_1.SqlOperator["and"];
            case Operator["||"]:
                return sql_1.SqlOperator["or"];
            case Operator["*"]:
                return sql_1.SqlOperator["*"];
            default:
                throw new Error(`Unknown operator: ${op}`);
        }
    }
    visitMember(member) {
        const identifier = member.member;
        const model = this.#model.properties.get(identifier.name);
        const node = new sql_1.SqlIdentifier(model.column);
        return !this.#aliases.isEmpty()
            ? new sql_1.SqlMember(this.#aliases.peek(), node)
            : node;
    }
    visitArray(array) {
        throw new Error("Method not implemented.");
    }
    visitObject(object) {
        const projection = object.properties.map((p) => p.accept(this));
        const keys = object.properties.map((p) => p.key.name);
        const shaper = (row) => {
            const o = {};
            keys.map((k, i) => (o[k] = row[i]));
            return o;
        };
        return new ShaperNode(projection, shaper);
    }
    visitObjectProperty(objectProperty) {
        return objectProperty.value?.accept(this);
    }
    visitTemplateLiteral(templateLiteral) {
        return templateLiteral.quasis
            .map((q, i) => {
            const quasi = q.raw.length > 0 ? q.accept(this) : undefined;
            const expr = templateLiteral.expressions.get(i)?.accept(this);
            return quasi && expr
                ? new sql_1.SqlBinary(quasi, sql_1.SqlOperator["||"], expr)
                : (quasi ?? expr);
        })
            .reduce((acc, next) => acc ? new sql_1.SqlBinary(acc, sql_1.SqlOperator["||"], next) : next);
    }
    visitTemplateElement(templateElement) {
        return new sql_1.SqlString(templateElement.raw);
    }
    visitIdentifier(identifier) {
        const index = this.argsMap.keyOf(identifier.name);
        if (index != undefined) {
            return new sql_1.SqlParameter(index + 1);
        }
        throw new Error(`Unbound identifier '${identifier.name}'`);
    }
    visitLiteral(literal) {
        return new sql_1.SqlString(literal.value);
    }
}
class ShaperNode extends sql_1.SqlNode {
    projection;
    shaper;
    static is(node) {
        return "projection" in node;
    }
    constructor(projection, shaper) {
        super();
        this.projection = projection;
        this.shaper = shaper;
    }
}
