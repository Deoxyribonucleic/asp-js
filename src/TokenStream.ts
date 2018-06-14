import { Stream, Bucket } from "./Stream";
import { InputStream } from "./InputStream";

export class TokenStream implements Stream {
	constructor(input: InputStream) {
		this.input = input;
	}

	next(): Bucket {
		let bucket = this.skipWhitespace();
		if (this.isIdentifierStart(bucket)) {
			return this.nextIdentifier(bucket);
		}
		else {
			return bucket;
		}
	}

	private nextIdentifier(start: Bucket): Bucket {
		let bucket;
		while ((bucket = this.input.peek()) !== null
			&& this.isIdentifier(bucket)) {
			this.input.next();
			start.content += bucket.content;
		}
		return start;
	}

	private skipWhitespace(): Bucket {
		let bucket;
		while ((bucket = this.input.next()) !== null) {
			if (!this.isWhitespace(bucket)) {
				break;
			}
		}

		return bucket;
	}

	private isWhitespace(bucket: Bucket): boolean {
		return (bucket.content === " "
			|| bucket.content === "\t"
			|| bucket.content === "\n");
	}

	private isIdentifierStart(bucket: Bucket): boolean {
		return bucket !== null && /[a-zA-Z_]/.test(bucket.content);
	}

	private isIdentifier(bucket: Bucket): boolean {
		return bucket !== null && /[a-zA-Z0-9_]/.test(bucket.content);
	}

	private input: InputStream;
}

