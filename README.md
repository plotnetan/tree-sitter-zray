# tree-sitter-zray

[Tree-sitter](https://tree-sitter.github.io) grammars for SAP ABAP development. They power the syntax highlighting,
bracket matching, indentation and outline of the Zray extension for Zed.

| Folder | Grammar | Sources |
|---|---|---|
| `abap/` | `abap` | ABAP (`.abap`): programs, includes, classes, interfaces and function groups |
| `cds/` | `abap_cds` | ABAP CDS: data definitions (`.ddls`), metadata extensions (`.ddlx`), access controls (`.dcls`) and service definitions (`.srvd`) |
| `bdef/` | `abap_bdef` | RAP behavior definitions (`.bdef`) |

The grammars are deliberately tolerant: they never need to reject a source. Exact parsing and validation are left to
the Zray language server.

- **ABAP**: parses statements (the tokens up to the closing period), keeping names together as single segments
  (`lo_x->attr`, `zcl_x=>c`, `ls_x-comp`, `<fs>-comp`). It also handles method calls (`meth( )`), balanced
  parentheses and brackets, string templates, pragmas and comments (`"` anywhere, and `*` in the first column via the
  external scanner in `abap/src/scanner.c`). Statements that open a unit (CLASS, INTERFACE, METHOD, FORM, FUNCTION,
  MODULE, METHODS, the program statement and events) produce nodes that carry the unit's name.
  Blocks such as IF ... ENDIF are intentionally not matched, so an include that opens a block closed in another file
  still parses without errors.
- **CDS**: parses tokens with balanced braces, plus definition heads (`define view entity X`).
- **BDEF**: parses tokens with balanced braces, plus the heads that name something (`define behavior for X`,
  `action X`, `determination X`, `association _X`, ...).

Keywords only match whole words (via tree-sitter's `word` rule), so `enddate` is read as a name, not as END followed
by DATE.

## Tested against real sources

| Grammar | Sources | Parsed without an error node |
|---|---|---|
| ABAP | 116,230 | All but 9 (2 truncated files, 6 chained calls such as `m(: a ), b ).`, 1 genuine source error) |
| CDS | 12,464 | All, except the two deliberately broken parser fixtures |
| BDEF | 37 (parser fixtures) | All, except the two deliberately broken fixtures |

## Repository layout

Each grammar folder contains:

- `grammar.js`: the grammar definition
- `src/`: the generated parser (`tree-sitter generate`, ABI 14)
- `queries/`: highlights, outline, brackets and indents

## License

MIT (see `LICENSE`).
