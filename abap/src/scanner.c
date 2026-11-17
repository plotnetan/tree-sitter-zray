// The external scanner of the ABAP grammar: a `*` in the first column starts a comment line.

#include "tree_sitter/parser.h"

enum TokenType { LINE_COMMENT };

void *tree_sitter_abap_external_scanner_create(void) { return NULL; }
void tree_sitter_abap_external_scanner_destroy(void *payload) { (void)payload; }
unsigned tree_sitter_abap_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}
void tree_sitter_abap_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_abap_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;
  if (!valid_symbols[LINE_COMMENT]) return false;
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' ||
         lexer->lookahead == '\n' || lexer->lookahead == '\f' || lexer->lookahead == 0xA0 ||
         lexer->lookahead == 0xFEFF) {
    lexer->advance(lexer, true);
  }
  if (lexer->lookahead != '*' || lexer->get_column(lexer) != 0) return false;
  while (lexer->lookahead != '\n' && !lexer->eof(lexer)) lexer->advance(lexer, false);
  lexer->result_symbol = LINE_COMMENT;
  return true;
}
