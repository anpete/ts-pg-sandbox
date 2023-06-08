"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlPrinter = exports.SqlStar = exports.SqlParameter = exports.SqlString = exports.SqlIdentifier = exports.SqlMember = exports.SqlAlias = exports.SqlOperator = exports.SqlBinary = exports.SqlSelect = exports.SqlNode = void 0;
class SqlNode {
    accept(_) {
        throw Error("Not implemented");
    }
}
exports.SqlNode = SqlNode;
class SqlSelect extends SqlNode {
    projection;
    from;
    where;
    constructor(projection, from, where) {
        super();
        this.projection = projection;
        this.from = from;
        this.where = where;
    }
    accept(visitor) {
        return visitor.visitSelect(this);
    }
}
exports.SqlSelect = SqlSelect;
class SqlBinary extends SqlNode {
    left;
    op;
    right;
    constructor(left, op, right) {
        super();
        this.left = left;
        this.op = op;
        this.right = right;
    }
    accept(visitor) {
        return visitor.visitBinary(this);
    }
}
exports.SqlBinary = SqlBinary;
var SqlOperator;
(function (SqlOperator) {
    SqlOperator[SqlOperator["="] = 0] = "=";
    SqlOperator[SqlOperator["<>"] = 1] = "<>";
    SqlOperator[SqlOperator[">"] = 2] = ">";
    SqlOperator[SqlOperator[">="] = 3] = ">=";
    SqlOperator[SqlOperator["<"] = 4] = "<";
    SqlOperator[SqlOperator["<="] = 5] = "<=";
    SqlOperator[SqlOperator["and"] = 6] = "and";
    SqlOperator[SqlOperator["or"] = 7] = "or";
    SqlOperator[SqlOperator["||"] = 8] = "||";
    SqlOperator[SqlOperator["*"] = 9] = "*";
})(SqlOperator || (exports.SqlOperator = SqlOperator = {}));
class SqlAlias extends SqlNode {
    target;
    alias;
    constructor(target, alias) {
        super();
        this.target = target;
        this.alias = alias;
    }
    accept(visitor) {
        return visitor.visitAlias(this);
    }
}
exports.SqlAlias = SqlAlias;
class SqlMember extends SqlNode {
    object;
    member;
    constructor(object, member) {
        super();
        this.object = object;
        this.member = member;
    }
    accept(visitor) {
        return visitor.visitMember(this);
    }
}
exports.SqlMember = SqlMember;
class SqlIdentifier extends SqlNode {
    name;
    constructor(name) {
        super();
        this.name = name;
    }
    accept(visitor) {
        return visitor.visitIdentifier(this);
    }
}
exports.SqlIdentifier = SqlIdentifier;
class SqlString extends SqlNode {
    value;
    constructor(value) {
        super();
        this.value = value;
    }
    accept(visitor) {
        return visitor.visitLiteral(this);
    }
}
exports.SqlString = SqlString;
class SqlParameter extends SqlNode {
    id;
    constructor(id) {
        super();
        this.id = id;
    }
    accept(visitor) {
        return visitor.visitParameter(this);
    }
}
exports.SqlParameter = SqlParameter;
class SqlStar extends SqlNode {
    static instance = new SqlStar();
    constructor() {
        super();
    }
    accept(visitor) {
        return visitor.visitStar(this);
    }
}
exports.SqlStar = SqlStar;
class SqlPrinter {
    visitSelect(select) {
        let sql = `select ${select.projection
            .map(n => n.accept(this))
            .join(", ")} from `;
        sql += this.parens(select.from);
        if (select.where) {
            sql += ` where ${select.where.accept(this)}`;
        }
        return sql;
    }
    visitAlias(alias) {
        return `${this.parens(alias.target)} as ${alias.alias.accept(this)}`;
    }
    visitBinary(binary) {
        return `${binary.left.accept(this)} ${SqlOperator[binary.op]} ${binary.right.accept(this)}`;
    }
    visitMember(member) {
        return `${member.object.accept(this)}.${member.member.accept(this)}`;
    }
    visitStar(_) {
        return "*";
    }
    visitIdentifier(identifier) {
        return `"${identifier.name}"`;
    }
    visitLiteral(literal) {
        return `'${literal.value}'`;
    }
    visitParameter(parameter) {
        return `$${parameter.id}`;
    }
    parens(node) {
        const nested = "projection" in node;
        let sql = "";
        if (nested) {
            sql += "(";
        }
        sql += node.accept(this);
        if (nested) {
            sql += ")";
        }
        return sql;
    }
}
exports.SqlPrinter = SqlPrinter;
