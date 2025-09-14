const FileHandler = require('../src/fileHandler');
const fs = require('fs').promises;
const path = require('path');

// Mock fs and sharp
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn()
  }
}));

jest.mock('sharp', () => {
  const mockSharp = jest.fn(() => ({
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed image data'))
  }));
  return mockSharp;
});

jest.mock('uuid', () => ({
  v4: jest.fn()
}));

const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

describe('FileHandler', () => {
  let fileHandler;
  const mockDate = new Date('2023-01-01T12:00:00.000Z');

  beforeEach(() => {
    fileHandler = new FileHandler();
    jest.clearAllMocks();
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate.toISOString());
    uuidv4.mockReturnValue('123e4567-e89b-12d3-a456-426614174000');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('saveText', () => {
    it('should save text content to file', async () => {
      fs.access.mockResolvedValue(); // Directory exists
      fs.writeFile.mockResolvedValue();
      
      const content = 'Hello, World!';
      const options = { filename: 'test.txt' };
      
      const result = await fileHandler.saveText(content, options);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.txt'),
        content,
        'utf8'
      );
      expect(result).toContain('test.txt');
    });

    it('should create directory if it does not exist', async () => {
      fs.access.mockRejectedValue({ code: 'ENOENT' });
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      
      const content = 'test content';
      const options = { outputPath: '/new/directory', filename: 'test.txt' };
      
      await fileHandler.saveText(content, options);
      
      expect(fs.mkdir).toHaveBeenCalledWith('/new/directory', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should generate unique filename if not provided', async () => {
      fs.access.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      
      const content = 'test content';
      
      const result = await fileHandler.saveText(content);
      
      expect(result).toContain('clipboard-2023-01-01T12-00-00-000Z-123e4567.txt');
    });

    it('should throw error if file write fails', async () => {
      fs.access.mockResolvedValue();
      fs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      const content = 'test content';
      
      await expect(fileHandler.saveText(content)).rejects.toThrow('Failed to save text file: Write failed');
    });
  });

  describe('saveImage', () => {
    it('should save image buffer to file', async () => {
      fs.access.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      
      const imageBuffer = Buffer.from('image data');
      const options = { filename: 'test.png', format: 'png' };
      
      const result = await fileHandler.saveImage(imageBuffer, options);
      
      expect(sharp).toHaveBeenCalledWith(imageBuffer);
      expect(fs.writeFile).toHaveBeenCalled();
      expect(result).toContain('test.png');
    });

    it('should process image with specified format and quality', async () => {
      fs.access.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      
      const mockJpeg = jest.fn().mockReturnThis();
      const mockToBuffer = jest.fn().mockResolvedValue(Buffer.from('processed image data'));
      
      sharp.mockReturnValue({
        jpeg: mockJpeg,
        png: jest.fn().mockReturnThis(),
        webp: jest.fn().mockReturnThis(),
        toBuffer: mockToBuffer
      });
      
      const imageBuffer = Buffer.from('image data');
      const options = { format: 'jpeg', quality: 80 };
      
      await fileHandler.saveImage(imageBuffer, options);
      
      expect(sharp).toHaveBeenCalledWith(imageBuffer);
      expect(mockJpeg).toHaveBeenCalledWith({ quality: 80 });
      expect(mockToBuffer).toHaveBeenCalled();
    });

    it('should default to PNG format', async () => {
      fs.access.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      
      const mockPng = jest.fn().mockReturnThis();
      const mockToBuffer = jest.fn().mockResolvedValue(Buffer.from('processed image data'));
      
      sharp.mockReturnValue({
        jpeg: jest.fn().mockReturnThis(),
        png: mockPng,
        webp: jest.fn().mockReturnThis(),
        toBuffer: mockToBuffer
      });
      
      const imageBuffer = Buffer.from('image data');
      
      await fileHandler.saveImage(imageBuffer);
      
      expect(sharp).toHaveBeenCalledWith(imageBuffer);
      expect(mockPng).toHaveBeenCalled();
      expect(mockToBuffer).toHaveBeenCalled();
    });

    it('should throw error if image processing fails', async () => {
      fs.access.mockResolvedValue();
      sharp.mockImplementation(() => {
        throw new Error('Sharp processing failed');
      });
      
      const imageBuffer = Buffer.from('image data');
      
      await expect(fileHandler.saveImage(imageBuffer)).rejects.toThrow('Failed to save image file');
    });
  });

  describe('generateFilePath', () => {
    it('should use provided filename and path', () => {
      const result = fileHandler.generateFilePath('/test/path', 'myfile.txt');
      
      expect(result).toBe('/test/path/myfile.txt');
    });

    it('should add extension if filename has none', () => {
      const result = fileHandler.generateFilePath('/test/path', 'myfile', '.txt');
      
      expect(result).toBe('/test/path/myfile.txt');
    });

    it('should generate unique filename if none provided', () => {
      const result = fileHandler.generateFilePath('/test/path', null, '.txt');
      
      expect(result).toContain('/test/path/clipboard-2023-01-01T12-00-00-000Z-123e4567.txt');
    });

    it('should use current working directory if no path provided', () => {
      const originalCwd = process.cwd();
      jest.spyOn(process, 'cwd').mockReturnValue('/current/dir');
      
      const result = fileHandler.generateFilePath(null, 'test.txt');
      
      expect(result).toBe('/current/dir/test.txt');
      
      process.cwd.mockRestore();
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should not create directory if it exists', async () => {
      fs.access.mockResolvedValue();
      
      await fileHandler.ensureDirectoryExists('/existing/dir');
      
      expect(fs.access).toHaveBeenCalledWith('/existing/dir');
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      fs.access.mockRejectedValue({ code: 'ENOENT' });
      fs.mkdir.mockResolvedValue();
      
      await fileHandler.ensureDirectoryExists('/new/dir');
      
      expect(fs.mkdir).toHaveBeenCalledWith('/new/dir', { recursive: true });
    });

    it('should throw error for access failures other than ENOENT', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.access.mockRejectedValue(error);
      
      await expect(fileHandler.ensureDirectoryExists('/restricted/dir')).rejects.toThrow('Permission denied');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      fs.access.mockResolvedValue();
      
      const result = await fileHandler.fileExists('/existing/file.txt');
      
      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/existing/file.txt');
    });

    it('should return false if file does not exist', async () => {
      fs.access.mockRejectedValue({ code: 'ENOENT' });
      
      const result = await fileHandler.fileExists('/missing/file.txt');
      
      expect(result).toBe(false);
    });
  });

  describe('getFileExtensionFromFormat', () => {
    it('should return correct extensions for supported formats', () => {
      expect(fileHandler.getFileExtensionFromFormat('jpeg')).toBe('.jpg');
      expect(fileHandler.getFileExtensionFromFormat('jpg')).toBe('.jpg');
      expect(fileHandler.getFileExtensionFromFormat('png')).toBe('.png');
      expect(fileHandler.getFileExtensionFromFormat('gif')).toBe('.gif');
      expect(fileHandler.getFileExtensionFromFormat('webp')).toBe('.webp');
    });

    it('should default to .png for unknown formats', () => {
      expect(fileHandler.getFileExtensionFromFormat('unknown')).toBe('.png');
    });

    it('should handle case insensitive formats', () => {
      expect(fileHandler.getFileExtensionFromFormat('JPEG')).toBe('.jpg');
      expect(fileHandler.getFileExtensionFromFormat('PNG')).toBe('.png');
    });
  });

  describe('getFileStats', () => {
    it('should return file statistics', async () => {
      const mockStats = {
        size: 1024,
        birthtime: new Date('2023-01-01'),
        mtime: new Date('2023-01-02'),
        isFile: () => true,
        isDirectory: () => false
      };
      fs.stat.mockResolvedValue(mockStats);
      
      const result = await fileHandler.getFileStats('/test/file.txt');
      
      expect(result).toEqual({
        size: 1024,
        created: mockStats.birthtime,
        modified: mockStats.mtime,
        isFile: true,
        isDirectory: false
      });
    });

    it('should throw error if stat fails', async () => {
      fs.stat.mockRejectedValue(new Error('Stat failed'));
      
      await expect(fileHandler.getFileStats('/missing/file.txt')).rejects.toThrow('Failed to get file stats: Stat failed');
    });
  });
});