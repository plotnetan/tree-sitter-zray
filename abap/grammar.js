/**
 * @file ABAP for editors (highlighting, brackets, outline)
 * @license MIT
 *
 * A tolerant grammar: a source is a sequence of statements (tokens up to a period) and comments. Names keep their
 * segments (`lo_x->attr`, `zcl_x=>c`, `ls_x-comp`, `<fs>-comp`, `if~meth`), a name directly followed by `(` is a
 * call, parentheses and brackets are balanced. The statements that open a unit have nodes of their own with the
 * name (CLASS, INTERFACE, METHOD, FORM, FUNCTION, MODULE, METHODS, the program, event blocks): the outline. Blocks
 * are not matched (IF ... ENDIF): an unbalanced include stays error-free; Zed indents by `increase_indent_pattern`.
 * The exact parsing is the language server's (Zray).
 *
 * Keywords are whole words (`word`): `enddate` is a name, not END + DATE. A keyword string belongs to one token only,
 * so the head keywords (METHOD, FORM ...) are tokens of their own, also inside statements (`CALL METHOD`).
 * Keywords with `-` (`CLASS-DATA`) are not words: they are tokens that win over a name and a selector.
 *
 * `*` comments (a `*` in the first column) come from the external scanner (`src/scanner.c`).
 */

/// A case-insensitive word (letters and `-`, `_`).
const ci = (word) =>
  word
    .split('')
    .map((c) => (/[a-zA-Z]/.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c === '-' ? '\\-' : c))
    .join('');
const kw = (words, p) => token(prec(p, new RegExp(words.map(ci).join('|'))));
const plain = (words) => words.filter((w) => !w.includes('-'));
const hyphen = (words) => words.filter((w) => w.includes('-'));

// Statement keywords and additions (ABAP keywords are not reserved: a name that is a keyword is shown as one).
const KEYWORDS = `
ADD ADD-CORRESPONDING ALIASES APPEND ASSERT ASSIGN AT AUTHORITY-CHECK BACK BREAK-POINT CALL CASE CATCH CHECK
CLASS-DATA CLASS-EVENTS CLEANUP CLEAR CLOSE COLLECT COMMIT COMMUNICATION COMPUTE CONCATENATE CONDENSE
CONSTANTS CONTEXTS CONTINUE CONTROLS CONVERT CREATE DATA DEFINE DELETE DEMAND DESCRIBE DETAIL DIVIDE
DIVIDE-CORRESPONDING DO EDITOR-CALL ELSE ELSEIF END-ENHANCEMENT-SECTION END-OF-DEFINITION END-TEST-INJECTION
END-TEST-SEAM ENDAT ENDCASE ENDCATCH ENDCLASS ENDDO ENDENHANCEMENT ENDEXEC ENDFORM ENDFUNCTION ENDIF ENDINTERFACE
ENDLOOP ENDMETHOD ENDMODULE ENDON ENDPROVIDE ENDSELECT ENDTRY ENDWHILE ENDWITH ENHANCEMENT ENHANCEMENT-POINT
ENHANCEMENT-SECTION EVENTS EXEC EXIT EXPORT EXTRACT FETCH FIELD-GROUPS FIELD-SYMBOLS FIELDS FIND FORMAT FREE
GENERATE GET HIDE IF IMPORT INCLUDE INFOTYPES INPUT INSERT INTERFACES LEAVE LOCAL
LOG-POINT LOOP MAXIMUM MESSAGE MINIMUM MODIFY MOVE MOVE-CORRESPONDING MULTIPLY MULTIPLY-CORRESPONDING NEW-LINE
NEW-PAGE NEW-SECTION NODES ON OPEN OVERLAY PACK PARAMETER PARAMETERS PERFORM POSITION PRINT-CONTROL PRIVATE
PROTECTED PROVIDE PUBLIC PACKAGE RAISE RANGES READ RECEIVE REFRESH REJECT REPLACE RESERVE RESUME RETRY RETURN
ROLLBACK SCROLL SEARCH SELECT SELECT-OPTIONS SELECTION-SCREEN SET SHIFT SKIP SORT SPLIT STATICS STOP SUBMIT
SUBTRACT SUBTRACT-CORRESPONDING SUM SUMMARY SUMMING SUPPLY SUPPRESS SYNTAX-CHECK SYNTAX-TRACE TABLES TEST-INJECTION
TEST-SEAM TRANSFER TRANSLATE TRY TYPE-POOLS TYPES ULINE UNASSIGN UNPACK UPDATE WAIT WHEN WHILE WINDOW
WITH WRITE LOAD PUT SYSTEM-CALL ENHANCEMENT-SPOTS PROCESS CHAIN ENDCHAIN FIELD HELP-REQUEST VALUE-REQUEST TRUNCATE
VERSION LINE-SELECTION USER-COMMAND DURING
ABSTRACT ALL AND APPENDING AS ASCENDING ASSIGNED ASSIGNING BETWEEN BINARY BOUND BY CA CASTING CHANGING CN CO
COMPONENTS COND CONV CORRESPONDING CP CS DEFAULT DEFINITION DESCENDING DISTINCT DIV EMPTY ENTRIES EQ EXCEPTIONS
EXPORTING FILTER FINAL FOR FROM GE GROUP GT HASHED HAVING IMPLEMENTATION IMPORTING IN INDEX INHERITING INITIAL INNER
INTO IS JOIN KEY LE LEFT LIKE LINE LINES LT MOD NA NE NEW NON-UNIQUE NOT NP NS OF OPTIONAL OR ORDER OTHERS OUTER
RAISING READ-ONLY RECEIVING REDEFINITION REDUCE REF REFERENCE RETURNING ROWS SECTION SINGLE SORTED STANDARD STRUCTURE
SUPPLIED SWITCH TABLE TESTING THEN TO TRANSPORTING TYPE UNIQUE UP USING VALUE WHERE BEGIN END OCCURS DECIMALS LENGTH
EVENT HANDLER DEFERRED FRIENDS RESULT ENTITIES ENTITY BYPASSING BUFFER CLIENT SPECIFIED UPTO DESTINATION
STARTING NEXT UNTIL LET BASE EXCEPT INSTANCE OBJECT ROUND CAST DATABASE PROCEDURE OPTIONS ID FIRST LAST
`.trim().split(/\s+/);

// Statements that open a unit: their keyword, then the unit's name.
const HEADS = {
  class: ['CLASS'],
  interface: ['INTERFACE'],
  method: ['METHOD'],
  form: ['FORM'],
  function: ['FUNCTION'],
  module: ['MODULE'],
  methods: ['METHODS', 'CLASS-METHODS'],
  program: ['REPORT', 'PROGRAM', 'FUNCTION-POOL', 'CLASS-POOL', 'INTERFACE-POOL', 'TYPE-POOL'],
};
// Event blocks (no name); `AT SELECTION-SCREEN` and the like are found by the outline query.
const EVENTS = ['START-OF-SELECTION', 'END-OF-SELECTION', 'INITIALIZATION', 'LOAD-OF-PROGRAM', 'TOP-OF-PAGE', 'END-OF-PAGE'];
const HEAD_WORDS = [...Object.values(HEADS).flat(), ...EVENTS];

// The tokens of the head keywords: `_head_<kind>` (plain words), `_head_<kind>_h` (words with `-`).
const headTokens = {};
for (const [kind, words] of Object.entries({ ...HEADS, event: EVENTS })) {
  if (plain(words).length) headTokens[`_head_${kind}`] = (_) => kw(plain(words), 0);
  if (hyphen(words).length) headTokens[`_head_${kind}_h`] = (_) => kw(hyphen(words), 1);
}
const headKeyword = ($, kind) =>
  choice(...[`_head_${kind}`, `_head_${kind}_h`].filter((n) => headTokens[n]).map((n) => alias($[n], $.keyword)));

// String templates `|text { expr } text|`: the expressions are kept in the token (highlighting only). An expression
// may hold literals (`{ '|' }`) and templates (`|{ condense( |{ x ALPHA = OUT }| ) }.pdf|`), two levels deep.
const QUOTED = String.raw`'([^'\n]|'')*'|` + '`[^`\\n]*`';
const TEXT = String.raw`[^|\\{]|\\.`;
const expr = (inner) => String.raw`\{([^{}|'` + '`' + String.raw`]|${QUOTED}|\|(${inner})*\|)*\}`;
const E1 = expr(TEXT);
const E2 = expr(`${TEXT}|${E1}`);
const TEMPLATE = new RegExp(String.raw`\|(${TEXT}|${E2})*\|`);

// `/ns/name`, `%cid`, `!param`, `&1` (macro parameters); `$` and `?` occur in old names (`CHAR$`, `G_VALID?`)
const NAME = /(\/[A-Za-z0-9_]+\/)?[A-Za-z_%!$][A-Za-z0-9_\/%$?]*|&[A-Za-z0-9_]+/;

module.exports = grammar({
  name: 'abap',

  // keywords are matched as whole words: a name that starts like one (`enddate`) stays a name
  word: ($) => $.identifier,

  externals: ($) => [$.line_comment],

  // non-breaking spaces and a byte order mark are blanks too
  extras: ($) => [/[\s ﻿]/, $.line_comment, $.comment, $.pragma],

  rules: {
    source_file: ($) => repeat($._statement),

    _statement: ($) =>
      choice(
        $.class_statement,
        $.interface_statement,
        $.method_statement,
        $.form_statement,
        $.function_statement,
        $.module_statement,
        $.methods_statement,
        $.program_statement,
        $.event_statement,
        $.statement,
        // an empty statement or a stray period
        '.',
      ),

    statement: ($) => seq(repeat1($._item), '.'),

    class_statement: ($) => head($, 'class'),
    interface_statement: ($) => head($, 'interface'),
    method_statement: ($) => head($, 'method'),
    form_statement: ($) => head($, 'form'),
    function_statement: ($) => head($, 'function'),
    module_statement: ($) => head($, 'module'),
    methods_statement: ($) => head($, 'methods'),
    program_statement: ($) => head($, 'program'),
    event_statement: ($) => seq(headKeyword($, 'event'), repeat($._item), '.'),

    _item: ($) =>
      choice(
        $.keyword,
        alias($._hyphen_keyword, $.keyword),
        // a head keyword inside a statement (`CALL METHOD`, `CALL FUNCTION`)
        ...Object.keys(headTokens)
          .filter((n) => !n.startsWith('_head_event'))
          .map((n) => alias($[n], $.keyword)),
        $._name,
        $.number,
        $.string,
        $.string_template,
        $.operator,
        $.punctuation,
        $.parenthesized,
        $.bracketed,
      ),

    _name: ($) => choice($.identifier, $.field_symbol, $.member_access, $.call),

    // `lo_x->attr`, `zcl_x=>c`, `ls_x-comp`, `<fs>-comp`, `zif_x~m`, `lr_x->*`
    member_access: ($) =>
      prec.left(
        seq(
          // a keyword or a number as the owner: an alias named like one (`up~posnr`, `105~pernr`); a table
          // expression (`itab[ 1 ]-comp`)
          choice($.identifier, $.field_symbol, $.call, $.keyword, $.number, $.bracketed),
          repeat1(
            seq(
              // `\_assoc` / `\assoc`: a mesh path
              alias(token.immediate(choice('->', '=>', '-', '~', '\\')), $.selector),
              choice(
                alias(token.immediate(choice(NAME, '*')), $.identifier),
                // a dynamic member: `lo_x->(lv_name)`
                seq(alias(token.immediate('('), '('), repeat($._item), ')'),
              ),
            ),
          ),
        ),
      ),

    // a name directly followed by `(`: a call (`meth( )`, `zcl_x=>m( )`, `NEW zcl_x( )`)
    call: ($) =>
      seq(field('function', choice($.identifier, $.member_access)), token.immediate('('), repeat($._item), ')'),

    parenthesized: ($) => seq('(', repeat($._item), ')'),
    bracketed: ($) => seq('[', repeat($._item), ']'),

    keyword: (_) => kw(plain(KEYWORDS.filter((k) => !HEAD_WORDS.includes(k))), 0),
    _hyphen_keyword: (_) => kw(hyphen(KEYWORDS.filter((k) => !HEAD_WORDS.includes(k))), 1),
    ...headTokens,

    identifier: (_) => NAME,
    field_symbol: (_) => /<[A-Za-z_][A-Za-z0-9_\/]*>/,
    number: (_) => /\d+/,
    // `'text'` (`''` inside) with an optional text symbol (`'Text'(001)`), `` `text` ``
    string: (_) => token(choice(/'([^'\n]|'')*'(\([A-Za-z0-9_]{1,3}\))?/, /`([^`\n]|``)*`/)),
    string_template: (_) => TEMPLATE,

    operator: (_) =>
      choice('=', '<>', '<=', '>=', '<', '>', '+', '-', '*', '/', '**', '&&', '&', '?=', '+=', '-=', '*=', '/=', '&&=', '#', '@'),
    // `;`: native SQL (AMDP, EXEC SQL)
    punctuation: (_) => choice(',', ':', ';'),

    // `"` to the end of the line
    comment: (_) => token(seq('"', /[^\n]*/)),
    // `##NEEDED`, `##NO_TEXT[...]`
    pragma: (_) => /##[A-Za-z0-9_]+(\[[^\]\n]*\])*/,
  },
});

/// A statement that opens a unit: its keyword, optionally `:`, the name, the rest. The name is optional: the
/// keyword may be a variable's name (`function = 'BACK'.`), `CLASS-POOL.` has none. ABAP keywords are not reserved:
/// the word after the head keyword is the name even when it is a keyword (`METHODS submit`).
function head($, kind) {
  return prec(
    2,
    seq(
      headKeyword($, kind),
      optional(':'),
      // a name that is a keyword (`METHODS submit`, `FORM select`) is the name, not a keyword
      optional(field('name', choice($.identifier, $.member_access, prec(1, alias($.keyword, $.identifier))))),
      repeat($._item),
      '.',
    ),
  );
}
