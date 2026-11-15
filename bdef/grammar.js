/**
 * @file ABAP RAP behavior definitions (BDEF) for editors (highlighting, brackets, indentation, outline)
 * @license MIT
 *
 * A tolerant grammar: tokens with balanced `{ }`, `( )`, `[ ]`, and the heads that name something: `define behavior
 * for X`, `action X`, `determination X`, `validation X`, `function X`, `event X`, `association _X`. The exact
 * parsing is the language server's (Zray).
 */

const ci = (word) =>
  word
    .split('')
    .map((c) => (/[a-zA-Z]/.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c === '-' ? '\\-' : c))
    .join('');
const kw = (words, p) => token(prec(p, new RegExp(words.map(ci).join('|'))));

const KEYWORDS = `
managed unmanaged abstract projection interface implementation in class unique strict define behavior for alias
persistent draft table query lock master dependent by etag total authorization global instance none update create
delete field readonly mandatory features numbering early late with save additional cleanup full data mapping
corresponding control except association action function determination validation determine on modify static
factory internal parameter result selective deep entity event managed side effects affects permissions entity use
precheck repeatable default optimized extensible extension using privileged mode disabling context own etag
change documents hierarchy collaborative cascading recursive suppress always augment from to of is not and or
foreign bound unbound
`.trim().split(/\s+/);

const NAMED = ['action', 'determination', 'validation', 'function', 'event'];

module.exports = grammar({
  name: 'abap_bdef',

  // keywords are matched as whole words: a name that starts like one (`enddate`, `determinations`) stays a name
  word: ($) => $.identifier,

  // non-breaking spaces and a byte order mark are blanks too
  extras: ($) => [/[\s ﻿]/, $.comment],

  rules: {
    source_file: ($) => repeat($._item),

    _item: ($) =>
      choice(
        $.behavior_definition,
        $.member_definition,
        $.association_definition,
        $.block,
        $.parenthesized,
        $.bracketed,
        $.keyword,
        $.association_name,
        $.identifier,
        $.self,
        $.string,
        $.number,
        $.operator,
        $.punctuation,
      ),

    // `define behavior for ZI_X`, `extend behavior for ZI_X`, `define own authorization context X`
    behavior_definition: ($) =>
      // the name is optional: `define own authorization context { ... }` has none
      prec.right(seq(alias(kw(['define', 'extend'], 0), $.keyword), repeat($.keyword), optional(field('name', $.identifier)))),

    // `action ( features : instance ) approve`, `determination setId`, `static factory action copy`
    member_definition: ($) =>
      prec.right(
        seq(alias(kw(NAMED, 0), $.keyword), repeat(choice($.keyword, $.parenthesized)), field('name', $.identifier)),
      ),

    // `association _Items`
    association_definition: ($) =>
      seq(alias(kw(['association'], 0), $.keyword), field('name', choice($.association_name, $.identifier))),

    block: ($) => seq('{', repeat($._item), '}'),
    parenthesized: ($) => seq('(', repeat($._item), ')'),
    bracketed: ($) => seq('[', repeat($._item), ']'),

    keyword: (_) => kw(KEYWORDS.filter((k) => !['define', 'extend', 'association', ...NAMED].includes(k)), 0),

    association_name: (_) => token(prec(2, /_[A-Za-z0-9_]*/)),
    identifier: (_) => /(\/[A-Za-z0-9_]+\/)?[A-Za-z_%][A-Za-z0-9_]*/,
    self: (_) => token(prec(2, /\$[sS][eE][lL][fF]/)),
    string: (_) => /'([^'\\\n]|''|\\.)*'/,
    number: (_) => /\d+/,
    operator: (_) => choice('=', '*', '..', '~'),
    punctuation: (_) => choice(',', ':', ';', '.'),

    comment: (_) => token(choice(seq('//', /[^\n]*/), seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'))),
  },
});
