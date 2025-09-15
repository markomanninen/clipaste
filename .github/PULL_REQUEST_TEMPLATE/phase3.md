# Summary

Implements Phase 3 features and docs:

- paste: `--resize`, `--auto-extension`
- get: `--base64`, `--json-format`, `--url-decode`, `--url-encode`, `--image-info`
- copy: `--encode-base64`, `--decode-base64`

## Changes

- CLI options and handlers updated in `src/cli.js`
- Image processing/resize and text extension heuristics in `src/fileHandler.js` and `src/utils/transform.js`
- Tests: unit + spawn-based smoke
- Docs: README examples and VHS demos

## New Commands and Flags

- paste `--resize <WxH|Wx|xH>` `--auto-extension`
- get `--base64` `--json-format` `--url-decode` `--url-encode` `--image-info`
- copy `--encode-base64 [data]` `--decode-base64 <data>`

## Demos

- `docs/demos/clipaste-phase3-transforms.tape` (JSON/URL/Base64)
- `docs/demos/clipaste-phase3-auto-extension.tape` (auto extension)
- `docs/demos/clipaste-phase3-image-resize.tape` (image resize/format)

## Checklist

- [ ] CLI help text updated for all commands
- [ ] README updated with examples and demo links
- [ ] Tests passing locally (`npm test`) and in Docker (`npm run test:docker`)
- [ ] No breaking changes to existing commands
- [ ] Error messages concise and actionable

## Testing Notes

- Headless environments: tests soft-skip real clipboard operations as needed
- Docker: includes Xvfb and runs full test + coverage

## Related Plans

- Phase overview: `ENHANCEMENT_PLAN.md`
- Phase 2 refined: `ENHANCEMENT_PLAN_PHASE_2.md`
- Phase 3 refined: `ENHANCEMENT_PLAN_PHASE_3.md`
- Phase 3B (copy image to clipboard): `ENHANCEMENT_PLAN_PHASE_3B.md`
