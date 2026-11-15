# tree-sitter-zray

[tree-sitter](https://tree-sitter.github.io) grammars for SAP ABAP development, used by the Zray extension for
Zed (highlighting, brackets, indentation, outline):

| folder | grammar | sources |
|---|---|---|
| `abap/` | `abap` | ABAP (`.abap`): programs, includes, classes, interfaces, function groups |
| `cds/` | `abap_cds` | ABAP CDS: data definitions (`.ddls`), metadata extensions (`.ddlx`), access controls (`.dcls`), service definitions (`.srvd`) |
| `bdef/` | `abap_bdef` | RAP behavior definitions (`.bdef`) |

The grammars are deliberately tolerant: they never have to reject a source, the exact parsing and the checks are the
language server's (Zray).

- **ABAP**: statements (tokens up to the period) with names kept in segments (`lo_x->attr`, `zcl_x=>c`,
  `ls_x-comp`, `<fs>-comp`), calls (`meth( )`), balanced parentheses and brackets, string templates, comments (`"`,
  and `*` in the first column through the external scanner `abap/src/scanner.c`), pragmas. The statements that open
  a unit (CLASS, INTERFACE, METHOD, FORM, FUNCTION, MODULE, METHODS, the program, events) have nodes with the name.
  Blocks (IF ... ENDIF) are not matched: an include that opens a block closed elsewhere stays error-free.
- **CDS**: tokens with balanced braces, the definition heads (`define view entity X`).
- **BDEF**: tokens with balanced braces, the heads that name something (`define behavior for X`, `action X`,
  `determination X`, `association _X` ...).

Keywords are whole words (`word`): `enddate` is a name, not END + DATE.

## Checked on real sources

| grammar | sources | without an error node |
|---|---|---|
| ABAP | 116,230 (three customer systems) | all but 9 (2 truncated files, 6 chained calls `m(: a ), b ).`, 1 source error) |
| CDS | 12,464 | all (but the two deliberately broken parser fixtures) |
| BDEF | 37 (parser fixtures) | all (but the two deliberately broken ones) |

## Files

Per grammar: `grammar.js`, `src/` (generated: `tree-sitter generate`, ABI 14), `queries/` (highlights, outline,
brackets, indents).

## License

MIT (`LICENSE`).
