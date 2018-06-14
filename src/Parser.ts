import { Bucket } from "./Stream";
import { TokenStream } from "./TokenStream";

export namespace ast {
	export class Node {
		constructor(bucket: Bucket) {
			this.bucket = bucket;
		}

		bucket: Bucket;
	}

	export class Block extends Node {
		constructor(bucket: Bucket, statements: Statement[]) {
			super(bucket);
			this.statements = statements;
		}

		statements: Statement[];
	}

	export class Statement extends Node {
	}

	export class Function extends Statement {
		constructor(bucket: Bucket, name: string, args: string[], block: Block) {
			super(bucket);
			this.name = name;
			this.args = args;
			this.block = block;
		}

		name: string;
		args: string[];
		block: Block;
	}

	export class Dim extends Statement {
		constructor(bucket: Bucket, name: string) {
			super(bucket);
			this.name = name;
		}

		name: string;
	}

	export class Assignment extends Statement {
		constructor(bucket: Bucket, variable: string[], expr: Expression) {
			super(bucket);
			this.variable = variable;
			this.expr = expr;
		}

		variable: string[];
		expr: Expression;
	}

	export class Expression extends Node {
	}

	export class Mul extends Expression {
		constructor(bucket: Bucket, left: Expression, right: Expression) {
			super(bucket);
			this.left = left;
			this.right = right;
		}

		left: Expression;
		right: Expression;
	}

	export class Add extends Expression {
		constructor(bucket: Bucket, left: Expression, right: Expression) {
			super(bucket);
			this.left = left;
			this.right = right;
		}

		left: Expression;
		right: Expression;
	}

	export class Literal extends Expression {
	}

	export class Integer extends Literal {
		constructor(bucket: Bucket, i: number) {
			super(bucket);
			this.i = i;
		}

		i: number;
	}

	export class Variable extends Expression {
		constructor(bucket: Bucket, name: string[]) {
			super(bucket);
			this.name = name;
		}

		name: string[];
	}

	export class Call extends Expression {
		constructor(bucket: Bucket, f: Expression, args: Expression[]) {
			super(bucket);
			this.f = f;
			this.args = args;
		}

		f: Expression;
		args: Expression[];
	}
}

export class Parser {
	constructor(tokens: TokenStream) {
		this.tokens = tokens;
	}

	parse(): ast.Block {
		return this.block();
	}

	private block(): ast.Block {
		let block = new ast.Block(this.tokens.peek(), []);

		let token: Bucket;
		while ((token = this.tokens.peek()).content !== null) {
			if (token.content === "function") {
				block.statements.push(this.function());
			}
			else if (token.content === "sub") {
				block.statements.push(this.function(false));
			}
			else if (token.content === "dim") {
				block.statements.push(this.dim());
			}
			else if (token.content === "end") {
				break;
			}
			else if (this.isIdentifier(token)) {
				const variable = this.variable();

				if (this.tokens.peek().content === "=") {
					block.statements.push(this.assignment(variable.name));
				}
				else {
					block.statements.push(this.callStatement(variable));
				}
			}
			else if (token.content === ":") {
				this.tokens.next();
			}
			else {
				this.error(token, `unexpected token '${token.content}' (expected statement)`);
			}
		}

		return block;
	}

	private function(func: boolean = true): ast.Function {
		const startToken = this.tokens.next(); // consume keyword

		const name = this.require().content;

		this.expect("(");
		const args = this.argList();
		this.expect(")");
		this.expect(":");

		const f = new ast.Function(startToken, name, args, this.block());

		this.expect("end");
		this.expect(func ? "function" : "sub");

		return f;
	}

	private argList(): string[] {
		let variables = [];
		while (this.tokens.peek().content !== ")") {
			variables.push(this.require().content);

			if (this.tokens.peek().content === ")") {
				break;
			}
			else {
				this.expect(",");
			}
		}
		return variables;
	}

	private dim(): ast.Dim {
		const keyword = this.tokens.next(); // consume keyword
		const name = this.require().content;
		return new ast.Dim(keyword, name);
	}

	private assignment(identifier: string[]): ast.Assignment {
		const operator = this.tokens.next(); // consume operator
		return new ast.Assignment(operator, identifier, this.expression());
	}

	private expression(): ast.Expression {
		let expr: ast.Expression = this.term();
		while (this.tokens.peek().content === "+") {
			const operator = this.tokens.next();
			expr = new ast.Add(operator, expr, this.term());
		}
		return expr;
	}

	private term(): ast.Expression {
		let term: ast.Expression = this.factor();
		while (this.tokens.peek().content === "*") {
			const operator = this.tokens.next();
			term = new ast.Mul(operator, term, this.factor());
		}
		return term;
	}

	private factor(): ast.Expression {
		const token = this.tokens.peek();
		let expr: ast.Expression;

		if (token.content === "(") {
			this.tokens.next();
			expr = this.expression();
			this.expect(")");
		}
		else if (this.isInteger(token)) {
			expr = new ast.Integer(token, Number(this.tokens.next().content));
		}
		else if (this.isIdentifier(token)) {
			expr = this.variable();
		}
		else {
			this.error(token, `unexpected token '${token.content}'`);
		}

		// Is this a function call?
		if (this.tokens.peek().content === "(") {
			expr = this.call(expr);
		}

		return expr;
	}

	private variable(): ast.Variable {
		const variable = new ast.Variable(this.tokens.peek(), [this.tokens.next().content]);
		while (this.tokens.peek().content === ".") {
			this.tokens.next();
			variable.name.push(this.identifier().content);
		}
		return variable;
	}

	private call(f: ast.Expression): ast.Call {
		const call = new ast.Call(f.bucket, f, []);
		this.expect("(");
		if (this.tokens.peek().content !== ")") {
			call.args.push(this.expression());
			while (this.tokens.peek().content === ",") {
				this.tokens.next();
				call.args.push(this.expression());
			}
		}
		this.expect(")");
		return call;
	}

	private callStatement(f: ast.Expression): ast.Call {
		const call = new ast.Call(f.bucket, f, []);
		if (this.tokens.peek().content === ":") {
			return call;
		}

		call.args.push(this.expression());

		while (this.tokens.peek().content === ",") {
			this.tokens.next();
			call.args.push(this.expression());
		}
		return call;
	}

	private require(): Bucket {
		const token = this.tokens.next();
		if (token.content === null) {
			this.error(token, "unexpected end of file");
		}

		return token;
	}

	private identifier(): Bucket {
		const token = this.require();
		if (!this.isIdentifier(token)) {
			this.error(token, `expected identifier, got '${token.content}'`);
		}

		return token;
	}

	private isIdentifier(token: Bucket): boolean {
		return /[a-zA-Z_][a-zA-Z0-9_]*/.test(token.content);
	}

	private isInteger(token: Bucket): boolean {
		return /[0-9]+/.test(token.content);
	}

	private isLiteral(token: Bucket): boolean {
		return this.isInteger(token); 
	}

	private isValue(token: Bucket): boolean {
		return this.isLiteral(token) || this.isIdentifier(token);
	}
		
	private expect(expected: string) {
		const actual = this.require();
		if (actual.content !== expected) {
			this.error(actual, `expected '${expected}', got '${actual.content}'`);
		}
	}

	private error(bucket: Bucket, message: string) {
		throw new Error(`syntax error in ${bucket.filename} at line ${bucket.line}, column ${bucket.position}: ${message}`);
	}

	private tokens: TokenStream;
}

