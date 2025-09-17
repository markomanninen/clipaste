# TODO: Windows and Linux Image Input/Output Support

This document outlines the remaining work needed to implement image-to-clipboard functionality for Windows and Linux platforms.

## Current Status

✅ **macOS**: Complete implementation using AppleScript  
✅ **Windows**: Complete implementation using PowerShell/.NET Framework  
❌ **Linux**: Not implemented  

## Windows Implementation Plan

### Reading Images from Clipboard (Already Implemented)
- ✅ Uses PowerShell with Windows.Forms.Clipboard
- ✅ Saves bitmap data to temporary PNG file
- ✅ Returns Buffer with image data

### Writing Images to Clipboard (✅ COMPLETED)

#### Implemented Solution: PowerShell with .NET Framework
```powershell
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile('C:\path\to\image.png')
[System.Windows.Forms.Clipboard]::SetImage($image)
$image.Dispose()
```

#### Completed Implementation Features
- ✅ Created `writeWindowsImage(imagePath)` method in ClipboardManager
- ✅ Handles various image formats (PNG, JPEG, GIF, BMP, SVG)
- ✅ Robust error handling for file access and clipboard operations
- ✅ Timeout mechanisms with cleanup of temporary PowerShell scripts
- ✅ Tested with Windows 10/11
- ✅ Enhanced error handling for completely empty clipboard states
- ✅ Round-trip testing: file → clipboard → file verification

## Linux Implementation Plan

### Reading Images from Clipboard (Partially Implemented)
- ⚠️ No current implementation (falls back to text)
- Need to implement platform-specific image reading

### Writing Images to Clipboard (TODO)

#### Approach 1: X11 with xclip
```bash
xclip -selection clipboard -t image/png -i < image.png
```

#### Approach 2: Wayland with wl-clipboard
```bash
wl-copy --type image/png < image.png
```

#### Implementation Tasks
- [ ] Detect X11 vs Wayland environment
- [ ] Create `writeLinuxImage(imagePath)` method in ClipboardManager
- [ ] Implement X11 support using xclip
- [ ] Implement Wayland support using wl-copy
- [ ] Add fallback mechanisms for different clipboard managers
- [ ] Handle MIME type detection and conversion
- [ ] Test across different Linux distributions

## Cross-Platform Considerations

### Format Support
- **PNG**: Primary format, widely supported
- **JPEG**: Secondary format, good compression
- **SVG**: Should be converted to PNG for clipboard compatibility
- **GIF**: Limited support, may need conversion
- **BMP**: Windows-specific, should work natively

### Error Handling
- [ ] Consistent error messages across platforms
- [ ] Graceful degradation when image support unavailable
- [ ] Clear platform capability detection

### Testing Strategy
- [ ] Platform-specific test suites
- [ ] CI/CD testing on Windows and Linux
- [ ] Format conversion testing
- [ ] Large file handling tests
- [ ] Memory usage optimization

## Dependencies

### Windows
- PowerShell (built-in on Windows 10+)
- .NET Framework (typically available)
- System.Drawing assembly
- System.Windows.Forms assembly

### Linux
- **X11**: xclip package (`sudo apt install xclip`)
- **Wayland**: wl-clipboard package (`sudo apt install wl-clipboard`)
- MIME type detection utilities

## Development Priorities

### ✅ Phase 1: Windows Support (COMPLETED)
1. ✅ Implemented `writeWindowsImage()` method
2. ✅ Added Windows-specific tests and updated existing test suite
3. ✅ Enhanced CLI error messaging and clipboard state handling
4. ✅ Documentation updates

### Phase 2: Linux Support  
1. Environment detection (X11/Wayland)
2. Implement `writeLinuxImage()` method
3. Add dependency detection and helpful error messages
4. Add Linux-specific tests

### Phase 3: Polish
1. Cross-platform integration tests
2. Performance optimization
3. Documentation completion
4. CI/CD updates for all platforms

## Implementation Notes

### Memory Management
- Use streaming for large images when possible
- Implement size limits to prevent memory issues
- Clean up temporary files properly

### Security Considerations
- Validate file paths to prevent path traversal
- Sanitize temporary file names
- Proper file permission handling

### User Experience
- Clear error messages when platform/dependencies unavailable
- Helpful installation instructions for missing dependencies
- Consistent behavior across platforms where possible

## Related Files

- `src/clipboard.js` - Main implementation file
- `tests/image-functionality.test.js` - Test suite
- `ENHANCEMENT_PLAN_PHASE_3B.md` - Original implementation plan
- `README.md` - User documentation

## References

- [Windows Clipboard API Documentation](https://docs.microsoft.com/en-us/dotnet/api/system.windows.forms.clipboard)
- [xclip documentation](https://github.com/astrand/xclip)
- [wl-clipboard documentation](https://github.com/bugaevc/wl-clipboard)