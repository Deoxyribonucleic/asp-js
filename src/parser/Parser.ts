import { Bucket } from "./Stream";
import { TokenStream } from "./TokenStream";
import { tokens } from "./Tokens";
import { ast } from "./AST";
import { Operators, BinaryFunction } from "./BinaryOperators";
import { syntaxError as error } from "../util";

export class Parser {
	constructor(tokens: TokenStream) {
		this.tokens = tokens;
	}

	parse(): ast.Block {
		return this.block();
	}

	block(): ast.Block {
		let block = new ast.Block(this.tokens.peek(), []);

		let token: Bucket;
		while ((token = this.tokens.peek()).content !== null) {
			if (token.content instanceof tokens.Inline) {
				this.tokens.next();
				block.statements.push(new ast.Call(token,
					new ast.Variable(token, ["response", "write"]),
					[new ast.Literal(token, token.content.value)]));

				// Hacky way of allowing <%=, and will allow without an
				// immediately following %> -- probably will not be a problem
				if (this.tokens.peek().content instanceof tokens.Punctuation
					&& this.tokens.peek().content.value === "=") {
					this.tokens.next();
					block.statements.push(new ast.Call(this.tokens.peek(),
						new ast.Variable(this.tokens.peek(), ["response", "write"]),
						[this.expression()]));
				}
			}
			else if (token.content instanceof tokens.Identifier) {
				if (token.content.value === "function") {
					block.statements.push(this.function());
				}
				else if (token.content.value === "sub") {
					block.statements.push(this.function(false));
				}
				else if (token.content.value === "class") {
					block.statements.push(this.klass());
				}
				else if (token.content.value === "dim") {
					block.statements.push(this.dim());
				}
				else if (token.content.value === "if") {
					block.statements.push(this.if());
				}
				else if (token.content.value === "set") {
					// TODO: can we just ignore set?
					this.tokens.next();
				}
				else if (token.content.value === "end"
					|| token.content.value === "else"
					|| token.content.value === "elseif") {
					break;
				}
				else {
					block.statements.push(this.assignmentOrSubCall());
				}
			}
			else if (token.content instanceof tokens.Punctuation) {
				if (token.content.value === ":") {
					this.tokens.next();
				}
				else {
					error(token, `unexpected token ${token.content} (expected statement)`);
				}
			}
			else {
				error(token, `unexpected token ${token.content} (expected statement)`);
			}
		}

		return block;
	}

	function(func: boolean = true): ast.Function {
		const keyword = this.tokens.next(); // consume keyword

		const name = this.require(tokens.Identifier);

		this.expect("(");
		const args = this.argList();
		this.expect(")");
		this.expect(":");

		const f = new ast.Function(keyword, new ast.Variable(name, [name.content.value]), args, this.block());

		this.expect("end");
		this.expect(func ? "function" : "sub");

		return f;
	}

	klass(): ast.Class {
		const keyword = this.tokens.next(); // consume keyword

		const name = this.require(tokens.Identifier).content.value;

		const k = new ast.Class(keyword, name, [], []);

		let token;
		while ((token = this.tokens.peek()).content.value !== "end") {
			if (token.content.value === "dim") {
				k.dims.push(this.dim());
			}
			else if (token.content.value === "function" || token.content.value === "sub") {
				k.methods.push(this.function(token.content.value === "function"));
			}
			else if (token.content.value === ":") {
				this.tokens.next();
			}
			else {
				error(token, `unexpected token ${token.content}`);
			}
		}

		this.expect("end");
		this.expect("class");

		return k;
	}

	argList(): ast.Argument[] {
		let args: ast.Argument[] = [];
		while (this.tokens.peek().content.value !== ")") {
			args.push(this.argument());

			if (this.tokens.peek().content.value === ")") {
				break;
			}
			else {
				this.expect(",");
			}
		}
		return args;
	}

	argument(): ast.Argument {
		let byref = false;
		let token = this.require(tokens.Identifier);
		if (token.content.value === "byref" || token.content.value === "byval") {
			byref = token.content.value === "byref";
			token = this.require(tokens.Identifier);
		}
		return new ast.Argument(token, token.content.value, byref);
	}

	dim(): ast.Dim {
		const keyword = this.tokens.next(); // consume keyword
		const name = this.require(tokens.Identifier).content.value;
		return new ast.Dim(keyword, name);
	}

	if(): ast.If {
		const keyword = this.tokens.next(); // consume keyword
		const expression = this.expression();
		this.expect("then");
		const block = this.block();
		const elseToken = this.tokens.peek();
		let elseBlock: ast.Block;

		if (!(elseToken.content instanceof tokens.Identifier)) {
			error(elseToken, `unexpected token ${elseToken.content}`);
		}
		else if (elseToken.content.value === "elseif") {
			elseBlock = new ast.Block(elseToken, [this.if()]);
		}
		else if (elseToken.content.value === "else") {
			this.tokens.next();
			elseBlock = this.block();
			this.expect("end");
			this.expect("if");
		}
		else if (elseToken.content.value === "end") {
			elseBlock = new ast.Block(elseToken, []);
			this.expect("end");
			this.expect("if");
		}
		else {
			error(elseToken, `invalid keyword ${elseToken.content}`);
		}

		return new ast.If(keyword, expression, block, elseBlock);
	}

	// This one is disgusting
	assignmentOrSubCall(): ast.Statement {
		const identifier = this.variable();
		const token = this.tokens.peek();

		if (token.content instanceof tokens.Punctuation) {
			if (token.content.value === "=") {
				this.tokens.next();
				return new ast.Assignment(token, identifier, this.expression());
			}
			else if (token.content.value === "(") {
				this.tokens.next();
				const args = this.args();
				this.expect(")", tokens.Punctuation);


				const nextToken = this.tokens.peek();
				if (nextToken.content instanceof tokens.Punctuation) {
					if (nextToken.content.value === "=") {
						// This is of the form f(1, ...) = ...
						this.tokens.next();
						return new ast.Assignment(nextToken, new ast.Call(token, identifier, args), this.expression());
					}
					else if (nextToken.content.value === ",") {
						// Turns out the first argument was just enclosed in parentheses
						this.tokens.next();
						
						if (args.length !== 1) {
							error(nextToken, `unexpected token ${nextToken}`);
						}

						args[0] = new ast.Parenthesis(token, args[0]);
						args.push(...this.args());
						return new ast.Call(token, identifier, args);
					}
					else if (nextToken.content.value === ":") {
						// This is of the format f(1, ...)
						// Note that this is only allowed if there is only one argument, in which case
						// it should actually be parsed as a sub call with one argument which happens to be enclosed in parentheses
						// TODO: decide whether enforcing this really is necessary
						if  (args.length !== 1) {
							error(token, "expected statement");
						}
						args[0] = new ast.Parenthesis(token, args[0]);
						return new ast.Call(token, identifier, args);
					}
				}
			}
		}

		// If we have parameters without a parenthesis or no more arguments,
		// we have a sub call
		return this.subCall(identifier);
	}

	//private assignment(leftHand: ast.Expression): ast.Assignment {
	//	const operator = this.tokens.next(); // consume operator
	//	return new ast.Assignment(operator, leftHand, this.expression());
	//}

	expression(): ast.Expression {
		let operatorFunctions: Function[] = [];
		// This is a bit of magic... :)
		Operators.forEach((group: any, i) => operatorFunctions.push(() => {
			let nextPrecedence = operatorFunctions[i + 1];
			if (nextPrecedence === undefined) {
				nextPrecedence = this.factor.bind(this);
			}

			let expr: ast.Expression = nextPrecedence();
			let f: BinaryFunction;
			while (true) {
				const operator = this.tokens.peek();
				if (!(operator.content instanceof tokens.Punctuation
					|| operator.content instanceof tokens.Identifier)) {
					break;
				}

				const f = group[operator.content.value];
				if (f === undefined) {
					break;
				}

				this.tokens.next();
				expr = new ast.BinaryOperator(operator, f, expr, nextPrecedence());
			}
			return expr;
		}));
		return operatorFunctions[0]();
	}

	// private expression(): ast.Expression {
	// 	let expr: ast.Expression = this.term();
	// 	while (this.tokens.peek().content.value === "+") {
	// 		const operator = this.tokens.next();
	// 		expr = new ast.Add(operator, expr, this.term());
	// 	}
	// 	return expr;
	// }

	// private term(): ast.Expression {
	// 	let term: ast.Expression = this.factor();
	// 	while (this.tokens.peek().content.value === "*") {
	// 		const operator = this.tokens.next();
	// 		term = new ast.Mul(operator, term, this.factor());
	// 	}
	// 	return term;
	// }

	factor(): ast.Expression {
		const token = this.tokens.peek();
		let expr: ast.Expression;

		if (this.isLiteral(token)) {
			expr = new ast.Literal(token, this.tokens.next().content.value);
		}
		else if (this.isIdentifier(token)) {
			if (token.content.value === "new") {
				return this.new();
			}
			if (token.content.value === "not") {
				this.tokens.next();
				const not = (a: any) => !a;
				return new ast.UnaryOperator(token, not, this.expression());
			}
			else {
				expr = this.variable();
			}
		}
		else if (token.content.value === "(") {
			this.tokens.next();
			expr = new ast.Parenthesis(token, this.expression());
			this.expect(")");
		}
		else if (token.content.value === "-") {
			this.tokens.next();
			const negate = (a: any) => -a;
			return new ast.UnaryOperator(token, negate, this.factor());
		}
		//else {
		//	error(token, `unexpected token ${token.content}`);
		//}

		// Is this a function call?
		if (this.require(tokens.Punctuation, false).content.value === "(") {
			expr = this.call(expr);
		}

		return expr;
	}

	new(): ast.New {
		const keyword = this.tokens.next();
		return new ast.New(keyword, this.require(tokens.Identifier).content.value);
	}

	variable(): ast.Variable {
		const variable = new ast.Variable(this.tokens.peek(), [this.tokens.next().content.value]);
		while (this.tokens.peek().content !== null && this.tokens.peek().content.value === ".") {
			this.tokens.next();
			variable.name.push(this.require(tokens.Identifier).content.value);
		}
		return variable;
	}

	call(f: ast.Expression): ast.Call {
		this.expect("(");
		const args = this.args();
		this.expect(")");
		return new ast.Call(f.bucket, f, args);
	}

	subCall(f: ast.Expression): ast.Call {
		return new ast.Call(f.bucket, f, this.args());
	}

	args(): ast.Expression[] {
		let args: ast.Expression[] = [];
		while (true) {
			let next = this.tokens.peek();
			if (next.content instanceof tokens.Punctuation
				&& (next.content.value === ":" || next.content.value === ")")) {
				break;
			}

			const arg = this.expression();
			args.push(arg);

			next = this.tokens.peek();
			if (!(next.content instanceof tokens.Punctuation)) {
				error(next, `unexpected token ${next}`);
			}
			else if(next.content.value !== ",") {
				break;
			}
			else {
				this.tokens.next();
			}
		}
		return args;
	}

	private require(type: Function, consume: boolean = true): Bucket {
		const token = consume ? this.tokens.next() : this.tokens.peek();
		if (token.content === null) {
			error(token, "unexpected end of file");
		}

		if (!(token.content instanceof type)) {
			error(token, `expected ${type.name}, got ${token.content}`);
		}

		return token;
	}

	private isIdentifier(token: Bucket): boolean {
		return token.content instanceof tokens.Identifier;
	}

	private isInteger(token: Bucket): boolean {
		return token.content instanceof tokens.Integer;
	}

	private isString(token: Bucket): boolean {
		return token.content instanceof tokens.String;
	}

	private isLiteral(token: Bucket): boolean {
		return this.isInteger(token) || this.isString(token);
	}

	private isValue(token: Bucket): boolean {
		return this.isLiteral(token) || this.isIdentifier(token);
	}
		
	private expect(expected: string, token = tokens.Token) {
		const actual = this.require(token); // allow any kind of token here
		if (actual.content.value !== expected) {
			error(actual, `expected '${expected}', got ${actual.content}`);
		}
	}

	private tokens: TokenStream;
}

