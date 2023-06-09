import {List} from "immutable";

export abstract class SqlNode {
    accept<T>(_: SqlVisitor<T>): T {
        throw Error("Not implemented");
    }
}

export class SqlSelect extends SqlNode {
    constructor(readonly projection: List<SqlNode>, readonly from: SqlNode, readonly where?: SqlNode) {
        super();
    }

    accept<T>(visitor: SqlVisitor<T>): T {
        return visitor.visitSelect(this);
    }
}

export class SqlBinary extends SqlNode {
    constructor(readonly left: SqlNode, readonly op: SqlOperator, readonly right: SqlNode) {
        super();
    }

    accept<T>(visitor: SqlVisitor<T>): T {
        return visitor.visitBinary(this);
    }
}

export type SqlOperator = "=" | "<>" | ">" | ">=" | "<" | "<=" | "and" | "or" | "||" | "*";

export class SqlAlias extends SqlNode {
    constructor(readonly target: SqlNode, readonly alias: SqlNode) {
        super();
    }

    accept<T>(visitor: SqlVisitor<T>): T {
        return visitor.visitAlias(this);
    }
}

export class SqlMember extends SqlNode {
    constructor(readonly object: SqlNode, readonly member: SqlNode) {
        super();
    }

    accept<T>(visitor: SqlVisitor<T>): T {
        return visitor.visitMember(this);
    }
}

export class SqlIdentifier extends SqlNode {
    constructor(readonly name: string) {
        super();
    }

    accept<T>(visitor: SqlVisitor<T>): T {
        return visitor.visitIdentifier(this);
    }
}

export class SqlString extends SqlNode {
    constructor(readonly value: any) {
        super();
    }

    accept<T>(visitor: SqlVisitor<T>): T {
        return visitor.visitLiteral(this);
    }
}

export class SqlParameter extends SqlNode {
    constructor(readonly id: number) {
        super();
    }

    accept<T>(visitor: SqlVisitor<T>): T {
        return visitor.visitParameter(this);
    }
}

export class SqlStar extends SqlNode {
    static instance: SqlStar = new SqlStar();

    private constructor() {
        super();
    }

    accept<T>(visitor: SqlVisitor<T>): T {
        return visitor.visitStar(this);
    }
}

interface SqlVisitor<T> {
    visitSelect(select: SqlSelect): T;

    visitBinary(binary: SqlBinary): T;

    visitAlias(alias: SqlAlias): T;

    visitMember(member: SqlMember): T;

    visitStar(star: SqlStar): T;

    visitIdentifier(identifier: SqlIdentifier): T;

    visitLiteral(literal: SqlString): T;

    visitParameter(parameter: SqlParameter): T;
}

export class SqlPrinter implements SqlVisitor<string> {
    visitSelect(select: SqlSelect): string {
        let sql = `select ${select.projection
                                  .map(n => n.accept(this))
                                  .join(", ")}
                   from `;

        sql += this.parens(select.from);

        if (select.where) {
            sql += ` where ${select.where.accept(this)}`;
        }

        return sql;
    }

    visitAlias(alias: SqlAlias): string {
        return `${this.parens(alias.target)} as ${alias.alias.accept(this)}`;
    }

    visitBinary(binary: SqlBinary): string {
        return `${binary.left.accept(this)} ${binary.op} ${binary.right.accept(this)}`;
    }

    visitMember(member: SqlMember): string {
        return `${member.object.accept(this)}.${member.member.accept(this)}`;
    }

    visitStar(_: SqlStar): string {
        return "*";
    }

    visitIdentifier(identifier: SqlIdentifier): string {
        return `"${identifier.name}"`;
    }

    visitLiteral(literal: SqlString): string {
        return `'${literal.value}'`;
    }

    visitParameter(parameter: SqlParameter): string {
        return `$${parameter.id}`;
    }

    private parens(node: SqlNode): string {
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
