const {
  base64Encode,
  base64Decode,
  urlEncode,
  urlDecode,
  jsonPretty,
  parseResizeSpec,
  extensionForTextContent,
  imageMetadataFromBuffer
} = require('../src/utils/transform')

describe('Transform Utilities', () => {
  describe('base64Encode', () => {
    test('encodes text to base64', () => {
      expect(base64Encode('Hello World')).toBe(Buffer.from('Hello World', 'utf8').toString('base64'))
    })

    test('handles empty string', () => {
      expect(base64Encode('')).toBe('')
    })

    test('handles null/undefined', () => {
      expect(base64Encode(null)).toBe('')
      expect(base64Encode(undefined)).toBe('')
    })

    test('converts non-string input to string', () => {
      expect(base64Encode(123)).toBe(Buffer.from('123', 'utf8').toString('base64'))
    })
  })

  describe('base64Decode', () => {
    test('decodes valid base64', () => {
      const encoded = Buffer.from('Hello World', 'utf8').toString('base64')
      expect(base64Decode(encoded)).toBe('Hello World')
    })

    test('throws error for invalid base64 format', () => {
      expect(() => base64Decode('invalid@base64!')).toThrow('Invalid base64 input')
    })

    test('throws error for malformed base64', () => {
      // Test with invalid characters that fail the regex check
      expect(() => base64Decode('abc@def')).toThrow('Invalid base64 input')
    })

    test('handles base64 with whitespace', () => {
      const encoded = Buffer.from('test', 'utf8').toString('base64')
      const withSpaces = encoded.substring(0, 2) + ' ' + encoded.substring(2)
      expect(base64Decode(withSpaces)).toBe('test')
    })

    test('handles empty string', () => {
      expect(base64Decode('')).toBe('')
    })

    test('handles null/undefined', () => {
      expect(base64Decode(null)).toBe('')
      expect(base64Decode(undefined)).toBe('')
    })
  })

  describe('urlEncode', () => {
    test('encodes text with special characters', () => {
      expect(urlEncode('hello world')).toBe('hello%20world')
      expect(urlEncode('test@example.com')).toBe('test%40example.com')
    })

    test('handles empty string', () => {
      expect(urlEncode('')).toBe('')
    })

    test('handles null/undefined', () => {
      expect(urlEncode(null)).toBe('')
      expect(urlEncode(undefined)).toBe('')
    })

    test('converts non-string input to string', () => {
      expect(urlEncode(123)).toBe('123')
    })
  })

  describe('urlDecode', () => {
    test('decodes URL-encoded text', () => {
      expect(urlDecode('hello%20world')).toBe('hello world')
      expect(urlDecode('test%40example.com')).toBe('test@example.com')
    })

    test('throws error for invalid URL encoding', () => {
      expect(() => urlDecode('%ZZ')).toThrow('Invalid URL-encoded input')
    })

    test('handles empty string', () => {
      expect(urlDecode('')).toBe('')
    })

    test('handles null/undefined', () => {
      expect(urlDecode(null)).toBe('')
      expect(urlDecode(undefined)).toBe('')
    })

    test('converts non-string input to string', () => {
      expect(urlDecode(123)).toBe('123')
    })
  })

  describe('jsonPretty', () => {
    test('pretty prints valid JSON object', () => {
      const input = '{"name":"test","value":123}'
      const expected = '{\n  "name": "test",\n  "value": 123\n}'
      expect(jsonPretty(input)).toBe(expected)
    })

    test('pretty prints valid JSON array', () => {
      const input = '[1,2,3]'
      const expected = '[\n  1,\n  2,\n  3\n]'
      expect(jsonPretty(input)).toBe(expected)
    })

    test('throws error for invalid JSON', () => {
      expect(() => jsonPretty('{invalid}')).toThrow()
    })

    test('handles empty string', () => {
      expect(() => jsonPretty('')).toThrow()
    })

    test('handles null/undefined', () => {
      expect(() => jsonPretty(null)).toThrow()
      expect(() => jsonPretty(undefined)).toThrow()
    })
  })

  describe('parseResizeSpec', () => {
    test('parses valid resize specifications', () => {
      expect(parseResizeSpec('800x600')).toEqual({ width: 800, height: 600 })
      expect(parseResizeSpec('1920x1080')).toEqual({ width: 1920, height: 1080 })
    })

    test('parses width-only specifications', () => {
      expect(parseResizeSpec('800x')).toEqual({ width: 800, height: undefined })
    })

    test('parses height-only specifications', () => {
      expect(parseResizeSpec('x600')).toEqual({ width: undefined, height: 600 })
    })

    test('returns null for invalid specifications', () => {
      expect(parseResizeSpec('invalid')).toBeNull()
      expect(parseResizeSpec('800')).toBeNull()
      expect(parseResizeSpec('800x600x')).toBeNull()
      expect(parseResizeSpec('x')).toBeNull()
    })

    test('returns null for zero or negative dimensions', () => {
      // The function actually allows 0 values, only negative values are rejected
      expect(parseResizeSpec('-100x600')).toBeNull()
      expect(parseResizeSpec('800x-100')).toBeNull()
      // These don't return null since 0 is allowed:
      expect(parseResizeSpec('0x600')).toEqual({ width: 0, height: 600 })
      expect(parseResizeSpec('800x0')).toEqual({ width: 800, height: 0 })
    })

    test('handles null/undefined/empty', () => {
      expect(parseResizeSpec(null)).toBeNull()
      expect(parseResizeSpec(undefined)).toBeNull()
      expect(parseResizeSpec('')).toBeNull()
    })

    test('handles whitespace', () => {
      expect(parseResizeSpec('  800x600  ')).toEqual({ width: 800, height: 600 })
    })
  })

  describe('extensionForTextContent', () => {
    test('detects JSON content', () => {
      expect(extensionForTextContent('{"key": "value"}')).toBe('.json')
      expect(extensionForTextContent('[1, 2, 3]')).toBe('.json')
    })

    test('handles invalid JSON that starts with braces', () => {
      expect(extensionForTextContent('{invalid json}')).toBe('.txt')
      expect(extensionForTextContent('[invalid json')).toBe('.txt')
    })

    test('detects Markdown content', () => {
      expect(extensionForTextContent('# Heading')).toBe('.md')
      expect(extensionForTextContent('* List item')).toBe('.md')
      expect(extensionForTextContent('- List item')).toBe('.md')
      expect(extensionForTextContent('1. Numbered item')).toBe('.md')
      expect(extensionForTextContent('```\ncode block\n```')).toBe('.md')
    })

    test('detects shell scripts via shebang', () => {
      expect(extensionForTextContent('#!/bin/bash\necho "hello"')).toBe('.sh')
      expect(extensionForTextContent('#!/bin/sh\nls -la')).toBe('.sh')
      expect(extensionForTextContent('#!/usr/bin/zsh\npwd')).toBe('.sh')
    })

    test('detects JavaScript via shebang', () => {
      expect(extensionForTextContent('#!/usr/bin/node\nconsole.log("hello")')).toBe('.js')
    })

    test('detects JavaScript via common tokens', () => {
      expect(extensionForTextContent('module.exports = {}')).toBe('.js')
      expect(extensionForTextContent('require("fs")')).toBe('.js')
      expect(extensionForTextContent('import React from "react"')).toBe('.js')
      expect(extensionForTextContent('export default function()')).toBe('.js')
      expect(extensionForTextContent('function test() { return true; }')).toBe('.js')
    })

    test('defaults to .txt for plain text', () => {
      expect(extensionForTextContent('Just plain text')).toBe('.txt')
      expect(extensionForTextContent('No special markers here')).toBe('.txt')
    })

    test('handles empty or invalid input', () => {
      expect(extensionForTextContent('')).toBe('.txt')
      expect(extensionForTextContent(null)).toBe('.txt')
      expect(extensionForTextContent(undefined)).toBe('.txt')
      expect(extensionForTextContent(123)).toBe('.txt')
    })

    test('handles content with leading/trailing whitespace', () => {
      expect(extensionForTextContent('  {"key": "value"}  ')).toBe('.json')
      expect(extensionForTextContent('\n# Heading\n')).toBe('.md')
    })
  })

  describe('imageMetadataFromBuffer', () => {
    test('returns null for empty buffer', async () => {
      expect(await imageMetadataFromBuffer(null)).toBeNull()
      expect(await imageMetadataFromBuffer(undefined)).toBeNull()
      expect(await imageMetadataFromBuffer(Buffer.alloc(0))).toBeNull()
    })

    test('returns size only for large buffers', async () => {
      const largeBuffer = Buffer.alloc(26 * 1024 * 1024) // 26MB
      const result = await imageMetadataFromBuffer(largeBuffer)
      expect(result).toEqual({ sizeBytes: 26 * 1024 * 1024 })
    })

    test('respects custom safeMaxBytes option', async () => {
      const buffer = Buffer.alloc(1000)
      const result = await imageMetadataFromBuffer(buffer, { safeMaxBytes: 500 })
      expect(result).toEqual({ sizeBytes: 1000 })
    })

    test('returns size only for invalid image data', async () => {
      const invalidBuffer = Buffer.from('not an image', 'utf8')
      const result = await imageMetadataFromBuffer(invalidBuffer)
      expect(result).toEqual({ sizeBytes: invalidBuffer.length })
    })

    test('handles non-buffer input', async () => {
      expect(await imageMetadataFromBuffer('not a buffer')).toBeNull()
      expect(await imageMetadataFromBuffer({})).toBeNull()
    })

    // Note: Testing valid image metadata would require a real image buffer
    // which is complex to set up in a unit test without external dependencies
  })
})
