/**
 * @file ABAP CDS (DDL, metadata extensions, access controls, service definitions) for editors
 * @license MIT
 *
 * A tolerant grammar for highlighting, brackets, indentation and the outline: the source is a sequence of
 * tokens with balanced braces / parentheses / brackets and the definition heads (`define view entity X`,
 * `extend view X`, `annotate entity X`, `define role X`, `define service X`). The language server (Zray)
 * parses CDS exactly; this grammar never has to reject a source.
 */

/// A case-insensitive keyword.
const ci = (word) =>
  new RegExp(
    word
      .split('')
      .map((c) => (/[a-z]/.test(c) ? `[${c}${c.toUpperCase()}]` : c))
      .join(''),
  );

// Keywords; CDS keywords are not reserved, words that are common names (`name`, `type`, `text`, `value`) are left out.
const KEYWORDS = [
  'abstract', 'all', 'and', 'annotate', 'as', 'ascending', 'association', 'between', 'by', 'case', 'cast',
  'child', 'composition', 'contract', 'cross', 'custom', 'define', 'descending', 'distinct', 'else', 'end',
  'entity', 'escape', 'exact', 'except', 'extend', 'external', 'false', 'from', 'full', 'function', 'grant',
  'group', 'having', 'hierarchy', 'implemented', 'in', 'inner', 'intersect', 'is', 'join', 'key', 'left',
  'like', 'many', 'method', 'not', 'null', 'of', 'on', 'one', 'or', 'order', 'outer', 'parameters', 'parent',
  'projection', 'provider', 'redefine', 'redirected', 'returns', 'right', 'role', 'root', 'select', 'service',
  'expose', 'table', 'then', 'to', 'true', 'union', 'view', 'virtual', 'when', 'where', 'with', 'aspect',
  'inheriting', 'conditions', 'initial', 'preserving', 'localized', 'include', 'bypass', 'pfcg_auth',
  'user', 'filter', 'default', 'abap', 'transient',
];


const keywordToken = (words, p = 0) => token(prec(p, choice(...words.map(ci))));

module.exports = grammar({
  name: 'abap_cds',

  // keywords are matched as whole words: a name that starts like one (`enddate`, `determinations`) stays a name
  word: ($) => $.identifier,

  // non-breaking spaces and a byte order mark are blanks too (sources copied from documents have them)
  extras: ($) => [/[\s\u00a0\ufeff]/, $.comment],

  rules: {
    source_file: ($) => repeat($._item),

    _item: ($) =>
      choice(
        $.definition,
        $.annotation,
        $.block,
        $.parenthesized,
        $.bracketed,
        $.keyword,
        $.association_name,
        $.identifier,
        $.dollar_identifier,
        $.quoted_identifier,
        $.string,
        $.number,
        $.enum_value,
        $.operator,
        $.punctuation,
      ),

    // `define [root] view entity X`, `extend view entity X`, `annotate entity X`, `define role X`
    definition: ($) =>
      seq(
        alias(keywordToken(['define', 'extend', 'annotate']), $.keyword),
        repeat($.keyword),
        field('name', $.identifier),
      ),

    block: ($) => seq('{', repeat($._item), '}'),
    parenthesized: ($) => seq('(', repeat($._item), ')'),
    bracketed: ($) => seq('[', repeat($._item), ']'),

    keyword: (_) => keywordToken(KEYWORDS.filter((k) => !['define', 'extend', 'annotate'].includes(k))),

    // `@Anno.path`, `@<Anno` (one token: the whole dotted name)
    annotation: (_) => token(seq('@', optional('<'), /[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/)),

    association_name: (_) => token(prec(2, /_[A-Za-z0-9_]*/)),
    identifier: (_) => /(\/[A-Za-z0-9_]+\/)?[A-Za-z_][A-Za-z0-9_]*/,
    dollar_identifier: (_) => /\$[A-Za-z_][A-Za-z0-9_]*/,
    quoted_identifier: (_) => /"[^"\n]*"/,
    string: (_) => /'([^'\\]|''|\\.)*'/,
    number: (_) => /\d+(\.\d+)?([eE][+-]?\d+)?/,
    enum_value: (_) => /#[A-Za-z0-9_\/][A-Za-z0-9_\/.]*/,

    operator: (_) => choice('=', '<>', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '||', '=>', '?=', '..'),
    punctuation: (_) => choice(',', ':', ';', '.', '#'),

    comment: (_) =>
      token(choice(seq('//', /[^\n]*/), seq('--', /[^\n]*/), seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'))),
  },
});
