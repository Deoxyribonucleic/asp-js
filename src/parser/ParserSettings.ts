
import * as parser from "parser-monad";

parser.ParserSettings.WHITESPACE = [" ", "\t", "_\n", "\r"];
parser.ParserSettings.LINE_COMMENT = ["'", "rem"];
parser.ParserSettings.CASE_SENSITIVE = false;