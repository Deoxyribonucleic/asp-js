import * as util from "util";
import { Context, Func, Box } from "../program/NewContext";
import { ast } from "../program/NewAST";

export class VBFunc extends Func {
	private declarationContext: Context;
	private definition: ast.Function;

	constructor(definition: ast.Function, declarationContext: Context) {
		super();
		this.definition = definition;
		this.declarationContext = declarationContext;
	}

	run(args: Box[]): Box {
		const scope = new Scope(this.definition.body, this.declarationContext);

		for (const i in args) {
			const name = this.definition.args[i].name;
			scope.context.set(name, args[i]);
		}

		//scope.run();

		return scope.context.returnValue;
	}
}

export class Scope {
	context: Context;
	body: ast.Statement;

	constructor(body: ast.Statement, parentContext: Context = null) {
		this.body = body;
		this.context = new Context(parentContext);
	}

//	hoist(statements: ast.Block = this.statements) {
//		for (const statement of statements) {
//			if (statement instanceof ast.Dim) {
//				this.context.declare(statement.name);
//			}
//			else if (statement instanceof ast.Function) {
//				this.context.declare(statement.name,
//					new VBFunc(statement, this.context));
//			}
//			else if (statement instanceof ast.Class) {
//				throw "classes not implemented";
//			}
//			else {
//				this.hoist(statement.subStatements());
//			}
//		}
//	}
//
//	run() {
//		this.hoist();
//		//console.log(util.inspect(this.context, {
//		//	depth: null,
//		//	colors: true,
//		//	compact: false,
//		//	customInspect: false,
//		//}));
//
//		this.execute(this.statements);
//	}

//	private execute(statements: ast.Statement[]) {
//		for (const statement of statements) {
//			//console.log("EXECUTING:", util.inspect(statement, {
//			//	depth: null,
//			//	colors: true,
//			//	compact: false,
//			//	customInspect: false,
//			//}));
//			statement.execute(this.context);
//		}
//	}
}
